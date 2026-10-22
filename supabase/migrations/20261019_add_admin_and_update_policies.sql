-- Secure Claims & Handovers RLS Policies
-- FindAI: keep claim state changes behind the authorized Express backend.

-- Remove unsafe direct client UPDATE policies.
DROP POLICY IF EXISTS "Participants can update their claims"
ON public.item_claims;

DROP POLICY IF EXISTS "Participants can update handover coordination"
ON public.item_handovers;

-- Allow trusted Supabase app_metadata roles to access claims.
DROP POLICY IF EXISTS "Admins have full access to item_claims"
ON public.item_claims;

CREATE POLICY "Admins have full access to item_claims"
ON public.item_claims
FOR ALL
TO authenticated
USING (
    (auth.jwt() -> 'app_metadata' ->> 'role')
    IN ('admin', 'security_reviewer')
)
WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'role')
    IN ('admin', 'security_reviewer')
);

-- Allow trusted Supabase app_metadata roles to access handovers.
DROP POLICY IF EXISTS "Admins have full access to item_handovers"
ON public.item_handovers;

CREATE POLICY "Admins have full access to item_handovers"
ON public.item_handovers
FOR ALL
TO authenticated
USING (
    (auth.jwt() -> 'app_metadata' ->> 'role')
    IN ('admin', 'security_reviewer')
)
WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'role')
    IN ('admin', 'security_reviewer')
);