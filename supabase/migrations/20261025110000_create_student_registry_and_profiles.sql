-- ==============================================================================
-- Migration: 20261025110000_create_student_registry_and_profiles.sql
-- Project: FindAI - University Lost-and-Found Platform
-- Phase 1 - Stage 2: Student Registry & Verified Student Profiles Schema (CORRECTED)
--
-- Objective:
-- 1. Create public.student_registry for storing official university student records.
--    Columns: registration_number, student_name, section, academic_year, branch,
--    official_email, is_eligible, metadata, imported_at, imported_by.
-- 2. Add automatic normalization triggers (uppercase trimming of registration numbers,
--    trimmed strings, lowercased emails) before uniqueness and constraint validation.
-- 3. Create public.student_profiles linking auth.users(id) to student_registry.
-- 4. Separate email verification, registry eligibility, and university identity verification:
--    - email_verified: tracks Supabase Auth email confirmation.
--    - verification_status: 'pending' | 'verified' | 'rejected' | 'suspended'.
--    - is_active: strictly computed; active ONLY when:
--        (a) email_verified = true, AND
--        (b) student_registry.is_eligible = true, AND
--        (c) verification_status = 'verified'.
--    Email verification alone NEVER activates a student account.
-- 5. Attach an automatic trigger on auth.users (INSERT OR UPDATE of email_confirmed_at)
--    that synchronizes student_profiles.email_verified without bypassing identity verification.
--    Trigger includes exception shielding to ensure Auth transactions never fail.
-- 6. Attach trigger trg_sync_student_profile_activation to guarantee is_active is
--    always synchronized and tamper-proof.
-- 7. Enable Row Level Security (RLS) with strict least-privilege separation:
--    - 'admin': Full access to student_registry.
--    - 'security_reviewer': Read-only access to verify student identities.
--    - Standard students: No access to student_registry; can only read their own profile.
--    - Public: Zero access (default deny).
-- 8. Idempotent updated_at trigger using public.handle_updated_at().
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 0. Ensure updated_at trigger helper exists and is compatible
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------------------------
-- 1. Table: public.student_registry
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.student_registry (
    registration_number VARCHAR(64) PRIMARY KEY,
    student_name VARCHAR(255) NOT NULL CHECK (char_length(trim(student_name)) >= 2),
    section VARCHAR(32) NOT NULL DEFAULT 'A' CHECK (char_length(trim(section)) >= 1),
    academic_year VARCHAR(32) NOT NULL DEFAULT '2nd Year' CHECK (char_length(trim(academic_year)) >= 1),
    branch VARCHAR(128) NOT NULL DEFAULT 'CSE' CHECK (char_length(trim(branch)) >= 2),
    official_email VARCHAR(255) UNIQUE CHECK (
        official_email IS NULL OR 
        official_email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+[.][A-Za-z]{2,}$'
    ),
    is_eligible BOOLEAN NOT NULL DEFAULT true,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    imported_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    imported_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT chk_reg_number_format CHECK (
        char_length(trim(registration_number)) >= 3 
        AND registration_number = upper(trim(registration_number))
    )
);

CREATE INDEX IF NOT EXISTS idx_student_registry_eligibility 
    ON public.student_registry (registration_number) 
    WHERE is_eligible = true;

CREATE INDEX IF NOT EXISTS idx_student_registry_branch_year 
    ON public.student_registry (branch, academic_year);

CREATE INDEX IF NOT EXISTS idx_student_registry_imported_at 
    ON public.student_registry (imported_at DESC);

-- Automatic normalization trigger for student_registry (runs BEFORE unique check)
CREATE OR REPLACE FUNCTION public.normalize_student_registry_input()
RETURNS TRIGGER AS $$
BEGIN
    NEW.registration_number = upper(trim(NEW.registration_number));
    NEW.student_name = trim(NEW.student_name);
    NEW.section = upper(trim(NEW.section));
    NEW.academic_year = trim(NEW.academic_year);
    NEW.branch = upper(trim(NEW.branch));
    IF NEW.official_email IS NOT NULL THEN
        NEW.official_email = lower(trim(NEW.official_email));
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_normalize_student_registry ON public.student_registry;
CREATE TRIGGER trg_normalize_student_registry
    BEFORE INSERT OR UPDATE ON public.student_registry
    FOR EACH ROW
    EXECUTE FUNCTION public.normalize_student_registry_input();

DROP TRIGGER IF EXISTS set_student_registry_updated_at ON public.student_registry;
CREATE TRIGGER set_student_registry_updated_at
    BEFORE UPDATE ON public.student_registry
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- Automatic cascade trigger: Synchronize student_profiles.is_active when student_registry.is_eligible changes
CREATE OR REPLACE FUNCTION public.sync_registry_eligibility_to_profiles()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_eligible IS DISTINCT FROM OLD.is_eligible THEN
        UPDATE public.student_profiles
        SET is_active = (CASE 
                WHEN NEW.is_eligible = true AND email_verified = true AND verification_status = 'verified' THEN true 
                ELSE false 
             END),
            updated_at = timezone('utc'::text, now())
        WHERE registration_number = NEW.registration_number;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trg_sync_registry_eligibility ON public.student_registry;
CREATE TRIGGER trg_sync_registry_eligibility
    AFTER UPDATE OF is_eligible ON public.student_registry
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_registry_eligibility_to_profiles();

-- ------------------------------------------------------------------------------
-- 2. Table: public.student_profiles
-- ------------------------------------------------------------------------------
-- is_active DEFAULTS TO FALSE:
-- Accounts activate ONLY when email_verified = true AND verification_status = 'verified' AND is_eligible = true!
CREATE TABLE IF NOT EXISTS public.student_profiles (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE RESTRICT,
    registration_number VARCHAR(64) NOT NULL UNIQUE REFERENCES public.student_registry(registration_number) ON DELETE RESTRICT,
    personal_email VARCHAR(255) NOT NULL CHECK (
        personal_email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+[.][A-Za-z]{2,}$'
    ),
    student_name VARCHAR(255) NOT NULL CHECK (char_length(trim(student_name)) >= 2),
    section VARCHAR(32) NOT NULL,
    academic_year VARCHAR(32) NOT NULL,
    branch VARCHAR(128) NOT NULL,
    email_verified BOOLEAN NOT NULL DEFAULT false,
    verification_status VARCHAR(32) NOT NULL DEFAULT 'pending' CHECK (
        verification_status IN ('pending', 'verified', 'rejected', 'suspended')
    ),
    verified_at TIMESTAMPTZ,
    verified_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    is_active BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT chk_profile_reg_number_format CHECK (
        registration_number = upper(trim(registration_number))
    )
);

CREATE INDEX IF NOT EXISTS idx_student_profiles_reg_no 
    ON public.student_profiles (registration_number);

CREATE INDEX IF NOT EXISTS idx_student_profiles_active 
    ON public.student_profiles (user_id) 
    WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_student_profiles_verification 
    ON public.student_profiles (verification_status);

-- Automatic normalization trigger for student_profiles
CREATE OR REPLACE FUNCTION public.normalize_student_profile_input()
RETURNS TRIGGER AS $$
BEGIN
    NEW.registration_number = upper(trim(NEW.registration_number));
    NEW.personal_email = lower(trim(NEW.personal_email));
    NEW.student_name = trim(NEW.student_name);
    NEW.section = upper(trim(NEW.section));
    NEW.academic_year = trim(NEW.academic_year);
    NEW.branch = upper(trim(NEW.branch));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_normalize_student_profile ON public.student_profiles;
CREATE TRIGGER trg_normalize_student_profile
    BEFORE INSERT OR UPDATE ON public.student_profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.normalize_student_profile_input();

-- Trigger to guarantee is_active is synchronized strictly according to all 3 conditions:
-- 1. email_verified = true
-- 2. verification_status = 'verified'
-- 3. student_registry.is_eligible = true
CREATE OR REPLACE FUNCTION public.sync_student_profile_activation()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.email_verified = true AND NEW.verification_status = 'verified' THEN
        IF EXISTS (
            SELECT 1 FROM public.student_registry sr
            WHERE sr.registration_number = NEW.registration_number
              AND sr.is_eligible = true
        ) THEN
            NEW.is_active = true;
        ELSE
            NEW.is_active = false;
        END IF;
    ELSE
        NEW.is_active = false;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_student_profile_activation ON public.student_profiles;
CREATE TRIGGER trg_sync_student_profile_activation
    BEFORE INSERT OR UPDATE OF email_verified, verification_status, registration_number ON public.student_profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_student_profile_activation();

DROP TRIGGER IF EXISTS set_student_profiles_updated_at ON public.student_profiles;
CREATE TRIGGER set_student_profiles_updated_at
    BEFORE UPDATE ON public.student_profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- ------------------------------------------------------------------------------
-- 3. Decoupled Email Confirmation Trigger on auth.users
-- ------------------------------------------------------------------------------
-- Updates email_verified flag ONLY. Does NOT blindly activate account!
-- Activation occurs strictly through trg_sync_student_profile_activation if all
-- 3 requirements are satisfied.
CREATE OR REPLACE FUNCTION public.handle_student_email_confirmed()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.email_confirmed_at IS NOT NULL 
       AND (TG_OP = 'INSERT' OR OLD.email_confirmed_at IS NULL OR OLD.email_confirmed_at IS DISTINCT FROM NEW.email_confirmed_at) THEN
        BEGIN
            UPDATE public.student_profiles
            SET email_verified = true,
                updated_at = timezone('utc'::text, now())
            WHERE user_id = NEW.id;
        EXCEPTION WHEN OTHERS THEN
            -- Shield GoTrue: log warning but never abort the auth transaction
            RAISE WARNING 'handle_student_email_confirmed: failed to update student profile for user %: %', NEW.id, SQLERRM;
        END;
    ELSIF NEW.email_confirmed_at IS NULL AND TG_OP = 'UPDATE' AND OLD.email_confirmed_at IS NOT NULL THEN
        -- If email confirmation was revoked or reset
        BEGIN
            UPDATE public.student_profiles
            SET email_verified = false,
                is_active = false,
                updated_at = timezone('utc'::text, now())
            WHERE user_id = NEW.id;
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'handle_student_email_confirmed: failed to reset profile active status for user %: %', NEW.id, SQLERRM;
        END;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS on_auth_user_email_confirmed ON auth.users;
CREATE TRIGGER on_auth_user_email_confirmed
    AFTER INSERT OR UPDATE OF email_confirmed_at ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_student_email_confirmed();

-- ------------------------------------------------------------------------------
-- 4. Row Level Security (RLS) Configuration
-- ------------------------------------------------------------------------------
ALTER TABLE public.student_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins have full access to student_registry" ON public.student_registry;
DROP POLICY IF EXISTS "Security reviewers have read access to student_registry" ON public.student_registry;
DROP POLICY IF EXISTS "Students can view their own profile" ON public.student_profiles;
DROP POLICY IF EXISTS "Staff have read access to student_profiles" ON public.student_profiles;

-- RLS: student_registry
-- Admins have full access (manage, import, edit)
CREATE POLICY "Admins have full access to student_registry"
ON public.student_registry
FOR ALL
TO authenticated
USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
)
WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
);

-- Security Reviewers have read-only access (for identity confirmation)
CREATE POLICY "Security reviewers have read access to student_registry"
ON public.student_registry
FOR SELECT
TO authenticated
USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'security_reviewer')
);

-- RLS: student_profiles
-- Students can read their own verified profile only
CREATE POLICY "Students can view their own profile"
ON public.student_profiles
FOR SELECT
TO authenticated
USING (
    auth.uid() = user_id
);

-- Staff and security reviewers have read access
CREATE POLICY "Staff have read access to student_profiles"
ON public.student_profiles
FOR SELECT
TO authenticated
USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'security_reviewer')
);

-- Direct client INSERT/UPDATE/DELETE is explicitly disallowed by omitting public write policies.
-- Writes are strictly handled through authorized server-side service role endpoints.
