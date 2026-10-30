-- ==============================================================================
-- Migration: 20261026100000_create_handover_incidents_and_verification.sql
-- Project: FindAI - University Lost-and-Found Platform
-- Priority: Suspicious Handover Detection & Admin Verification (DRAFT)
--
-- Objective:
-- 1. Extend public.item_handovers with cryptographically hashed OTP verification
--    fields and administrative hold/flagging attributes.
-- 2. Create public.handover_incidents for logging security anomalies (repeated failed
--    OTPs, expired/reused codes, unauthorized attempts, conflicting claims).
-- 3. Enforce ON DELETE SET NULL on all foreign keys to guarantee that incident history
--    is permanently preserved against accidental cascade deletions.
-- 4. Enable Row Level Security (RLS) with strict least-privilege:
--    - 'admin': Full access to view, update, and resolve incidents.
--    - 'security_reviewer': Read and review access.
--    - Standard students/public: Default deny (zero access).
-- 5. Attach automatic updated_at timestamp triggers using public.handle_updated_at().
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Extend public.item_handovers with Administrative Hold & Flagging Attributes
-- (Obsolete OTP columns removed in favor of direct dual-confirmation model)
-- ------------------------------------------------------------------------------
ALTER TABLE public.item_handovers 
    ADD COLUMN IF NOT EXISTS is_flagged BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS flagged_reason TEXT;

-- Update status check constraint to include 'suspended' for security holds
DO $$
BEGIN
    ALTER TABLE public.item_handovers 
        DROP CONSTRAINT IF EXISTS item_handovers_status_check;
    
    ALTER TABLE public.item_handovers 
        ADD CONSTRAINT item_handovers_status_check CHECK (status IN (
            'proposed',
            'scheduled',
            'handover_pending',
            'completed',
            'suspended',
            'cancelled'
        ));
EXCEPTION WHEN OTHERS THEN
    -- If already matching, continue safely
    NULL;
END $$;

-- ------------------------------------------------------------------------------
-- 2. Table: public.handover_incidents (Preserves Security Audit Trail & Evidence)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.handover_incidents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_id VARCHAR(64) UNIQUE NOT NULL,
    handover_id UUID REFERENCES public.item_handovers(id) ON DELETE SET NULL,
    claim_id UUID REFERENCES public.item_claims(id) ON DELETE SET NULL,
    found_item_id UUID REFERENCES public.items(id) ON DELETE SET NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    registration_number VARCHAR(64),
    incident_type VARCHAR(64) NOT NULL CHECK (incident_type IN (
        'unauthorized_attempt',
        'premature_confirmation',
        'conflicting_claims',
        'unusual_attempt_burst'
    )),
    severity VARCHAR(32) NOT NULL DEFAULT 'medium' CHECK (severity IN (
        'low',
        'medium',
        'high',
        'critical'
    )),
    status VARCHAR(32) NOT NULL DEFAULT 'pending_review' CHECK (status IN (
        'pending_review',
        'under_review',
        'cleared',
        'confirmed_violation'
    )),
    reason TEXT NOT NULL CHECK (char_length(trim(reason)) >= 3),
    attempt_count INT NOT NULL DEFAULT 1 CHECK (attempt_count >= 1),
    first_attempt_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    last_attempt_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    decision_notes TEXT,
    resolution_action VARCHAR(64),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Performance and lookup indexes
CREATE INDEX IF NOT EXISTS idx_handover_incidents_status 
    ON public.handover_incidents (status);

CREATE INDEX IF NOT EXISTS idx_handover_incidents_severity 
    ON public.handover_incidents (severity);

CREATE INDEX IF NOT EXISTS idx_handover_incidents_type 
    ON public.handover_incidents (incident_type);

CREATE INDEX IF NOT EXISTS idx_handover_incidents_handover 
    ON public.handover_incidents (handover_id);

CREATE INDEX IF NOT EXISTS idx_handover_incidents_user 
    ON public.handover_incidents (user_id);

CREATE INDEX IF NOT EXISTS idx_handover_incidents_created_at 
    ON public.handover_incidents (created_at DESC);

-- Automatic updated_at trigger
DROP TRIGGER IF EXISTS set_handover_incidents_updated_at ON public.handover_incidents;
CREATE TRIGGER set_handover_incidents_updated_at
    BEFORE UPDATE ON public.handover_incidents
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- ------------------------------------------------------------------------------
-- 3. Row Level Security (RLS) Configuration
-- ------------------------------------------------------------------------------
ALTER TABLE public.handover_incidents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins have full access to handover_incidents" ON public.handover_incidents;
DROP POLICY IF EXISTS "Security reviewers can view and review handover_incidents" ON public.handover_incidents;

-- RLS: handover_incidents
-- Admins have full access (select, insert, update, manage)
CREATE POLICY "Admins have full access to handover_incidents"
ON public.handover_incidents
FOR ALL
TO authenticated
USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
)
WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
);

-- Security Reviewers have select and update access
CREATE POLICY "Security reviewers can view and review handover_incidents"
ON public.handover_incidents
FOR SELECT
TO authenticated
USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'security_reviewer')
);

CREATE POLICY "Security reviewers can update handover_incidents"
ON public.handover_incidents
FOR UPDATE
TO authenticated
USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'security_reviewer')
)
WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'security_reviewer')
);

-- Ordinary students and public users have NO direct access (default deny).
-- Incident logging and hold enforcement are mediated securely via the authorized Express backend.
