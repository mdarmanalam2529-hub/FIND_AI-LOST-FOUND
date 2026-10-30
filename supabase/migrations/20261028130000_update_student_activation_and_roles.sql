-- ==============================================================================
-- Migration: 20261028130000_update_student_activation_and_roles.sql
-- Project: FindAI - University Lost-and-Found Platform
-- Scope: Simplified Student Activation & Role-Based Access Control (RBAC)
-- ==============================================================================

-- 1. Update student profile activation trigger
-- Removes email verification as an activation blocker.
-- Accounts activate strictly based on student_registry eligibility and non-suspended status.
CREATE OR REPLACE FUNCTION public.sync_student_profile_activation()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.verification_status NOT IN ('rejected', 'suspended') THEN
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

-- 2. Update cascade trigger on student_registry for is_eligible changes
CREATE OR REPLACE FUNCTION public.sync_registry_eligibility_to_profiles()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_eligible IS DISTINCT FROM OLD.is_eligible THEN
        UPDATE public.student_profiles
        SET is_active = (CASE 
                WHEN NEW.is_eligible = true AND verification_status NOT IN ('rejected', 'suspended') THEN true 
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

-- 3. RLS Policies: Support primary_admin, super_admin, admin, staff, and security_reviewer
DROP POLICY IF EXISTS "Admins have full access to student_registry" ON public.student_registry;
DROP POLICY IF EXISTS "Security reviewers have read access to student_registry" ON public.student_registry;
DROP POLICY IF EXISTS "Staff and reviewers have read access to student_registry" ON public.student_registry;

CREATE POLICY "Admins have full access to student_registry"
ON public.student_registry
FOR ALL
TO authenticated
USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'primary_admin', 'super_admin')
)
WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'primary_admin', 'super_admin')
);

CREATE POLICY "Staff and reviewers have read access to student_registry"
ON public.student_registry
FOR SELECT
TO authenticated
USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'primary_admin', 'super_admin', 'staff', 'security_reviewer')
);

-- RLS: student_profiles for staff & admins
DROP POLICY IF EXISTS "Staff have read access to student_profiles" ON public.student_profiles;
CREATE POLICY "Staff have read access to student_profiles"
ON public.student_profiles
FOR SELECT
TO authenticated
USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'primary_admin', 'super_admin', 'staff', 'security_reviewer')
);

-- RLS: admin_audit_logs view access
DROP POLICY IF EXISTS "Admins can view audit logs" ON public.admin_audit_logs;
CREATE POLICY "Admins can view audit logs"
ON public.admin_audit_logs
FOR SELECT
TO authenticated
USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'primary_admin', 'super_admin')
);

