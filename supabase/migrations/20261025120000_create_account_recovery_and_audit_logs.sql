-- ==============================================================================
-- Migration: 20261025120000_create_account_recovery_and_audit_logs.sql
-- Project: FindAI - University Lost-and-Found Platform
-- Phase 1 - Stage 3: Account Recovery Requests & Immutable Administrative Audit Logs (REVISED)
--
-- Objective:
-- 1. Create public.account_recovery_requests for managing university admin-assisted
--    identity verification and lost-device recovery workflows.
-- 2. Create public.admin_audit_logs for recording an immutable, tamper-evident
--    trail of all administrative decisions (registry imports, recoveries, replacements).
-- 3. Configure actor_id ON DELETE SET NULL on audit logs to guarantee that administrative
--    account lifecycle events (e.g. staff departure) never destroy or deadlock audit history.
-- 4. Create dedicated private storage bucket 'identity-documents' with strict RLS
--    preventing public or unauthorized access to student identity proofs.
-- 5. Enable Row Level Security (RLS) with strict least-privilege separation:
--    - 'admin': Full management and approval authority.
--    - 'security_reviewer': Read-only inspection.
-- 6. Attach append-only enforcement triggers to prevent log tampering.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Table: public.account_recovery_requests
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.account_recovery_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    registration_number VARCHAR(64) NOT NULL REFERENCES public.student_registry(registration_number) ON DELETE RESTRICT,
    old_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    new_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    requested_email VARCHAR(255) NOT NULL CHECK (requested_email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
    contact_phone TEXT,
    id_document_path TEXT,
    status VARCHAR(32) NOT NULL DEFAULT 'pending' CHECK (status IN (
        'pending',
        'in_review',
        'approved',
        'rejected',
        'cancelled'
    )),
    recovery_type VARCHAR(32) NOT NULL DEFAULT 'in_place' CHECK (recovery_type IN (
        'in_place',
        'replacement'
    )),
    verification_method TEXT NOT NULL CHECK (char_length(trim(verification_method)) >= 3),
    admin_notes TEXT,
    resolution_summary TEXT,
    reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_recovery_requests_reg_no 
    ON public.account_recovery_requests (registration_number);

CREATE INDEX IF NOT EXISTS idx_recovery_requests_status 
    ON public.account_recovery_requests (status);

CREATE INDEX IF NOT EXISTS idx_recovery_requests_created_at 
    ON public.account_recovery_requests (created_at DESC);

-- Automatic normalization trigger for recovery requests
CREATE OR REPLACE FUNCTION public.normalize_recovery_request_input()
RETURNS TRIGGER AS $$
BEGIN
    NEW.registration_number = upper(trim(NEW.registration_number));
    NEW.requested_email = lower(trim(NEW.requested_email));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_normalize_recovery_request ON public.account_recovery_requests;
CREATE TRIGGER trg_normalize_recovery_request
    BEFORE INSERT OR UPDATE ON public.account_recovery_requests
    FOR EACH ROW
    EXECUTE FUNCTION public.normalize_recovery_request_input();

DROP TRIGGER IF EXISTS set_recovery_requests_updated_at ON public.account_recovery_requests;
CREATE TRIGGER set_recovery_requests_updated_at
    BEFORE UPDATE ON public.account_recovery_requests
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- ------------------------------------------------------------------------------
-- 2. Table: public.admin_audit_logs (Immutable & Resilient to Staff Departure)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    actor_name VARCHAR(255) NOT NULL CHECK (char_length(trim(actor_name)) >= 2),
    actor_email VARCHAR(255) NOT NULL CHECK (actor_email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
    actor_role VARCHAR(64) NOT NULL,
    action VARCHAR(64) NOT NULL CHECK (char_length(trim(action)) >= 2),
    target_type VARCHAR(64) NOT NULL,
    target_identifier TEXT NOT NULL,
    reason TEXT NOT NULL CHECK (char_length(trim(reason)) >= 3),
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    ip_address TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_actor 
    ON public.admin_audit_logs (actor_id);

CREATE INDEX IF NOT EXISTS idx_audit_logs_action 
    ON public.admin_audit_logs (action);

CREATE INDEX IF NOT EXISTS idx_audit_logs_target 
    ON public.admin_audit_logs (target_type, target_identifier);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at 
    ON public.admin_audit_logs (created_at DESC);

-- Prevent any modification or deletion on audit logs (Append-only enforcement)
CREATE OR REPLACE FUNCTION public.prevent_audit_log_modification()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Administrative audit logs are strictly append-only and cannot be updated or deleted.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_audit_log_modification ON public.admin_audit_logs;
CREATE TRIGGER trg_prevent_audit_log_modification
    BEFORE UPDATE OR DELETE ON public.admin_audit_logs
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_audit_log_modification();

-- ------------------------------------------------------------------------------
-- 3. Storage Bucket: private identity-documents
-- ------------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'identity-documents',
    'identity-documents',
    false, -- Strictly private
    10485760, -- 10 MB limit
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
    public = false,
    file_size_limit = 10485760,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

-- ------------------------------------------------------------------------------
-- 4. Row Level Security (RLS) Configuration
-- ------------------------------------------------------------------------------
ALTER TABLE public.account_recovery_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins have full access to account_recovery_requests" ON public.account_recovery_requests;
DROP POLICY IF EXISTS "Security reviewers have read access to account_recovery_requests" ON public.account_recovery_requests;
DROP POLICY IF EXISTS "Staff have read access to admin_audit_logs" ON public.admin_audit_logs;
DROP POLICY IF EXISTS "Staff can insert audit log entries" ON public.admin_audit_logs;
DROP POLICY IF EXISTS "Staff can read identity documents" ON storage.objects;
DROP POLICY IF EXISTS "Claimants can upload recovery identity documents" ON storage.objects;

-- RLS: account_recovery_requests
-- Full management restricted to 'admin'
CREATE POLICY "Admins have full access to account_recovery_requests"
ON public.account_recovery_requests
FOR ALL
TO authenticated
USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
)
WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
);

-- Security reviewers have read-only inspection
CREATE POLICY "Security reviewers have read access to account_recovery_requests"
ON public.account_recovery_requests
FOR SELECT
TO authenticated
USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'security_reviewer')
);

-- RLS: admin_audit_logs
-- Both admins and security reviewers can view the audit trail
CREATE POLICY "Staff have read access to admin_audit_logs"
ON public.admin_audit_logs
FOR SELECT
TO authenticated
USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'security_reviewer')
);

-- Authorized staff and service role can insert audit records
CREATE POLICY "Staff can insert audit log entries"
ON public.admin_audit_logs
FOR INSERT
TO authenticated
WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'security_reviewer')
    AND (actor_id IS NULL OR actor_id = auth.uid())
);

-- RLS: storage.objects for identity-documents bucket
CREATE POLICY "Staff can read identity documents"
ON storage.objects FOR SELECT
TO authenticated
USING (
    bucket_id = 'identity-documents'
    AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'security_reviewer')
);

CREATE POLICY "Claimants can upload recovery identity documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'identity-documents'
    AND (storage.foldername(name))[1] = (auth.uid())::text
);
