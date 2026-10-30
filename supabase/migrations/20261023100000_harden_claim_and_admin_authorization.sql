-- ==============================================================================
-- Migration: 20261023100000_harden_claim_and_admin_authorization.sql
-- Project: FindAI - AI Lost-and-Found Matcher
-- Milestone 2: Critical Authorization Hardening
--
-- Objective:
-- 1. Enforce strict database-level authorization boundary on item_claims creation.
--    Prevents direct client insertion with privileged fields (status = 'approved',
--    reviewed_by, admin_notes, etc.).
-- 2. Verify that ordinary users have no direct UPDATE capability on item_claims
--    or item_handovers (preventing self-approval or tampering).
-- 3. Secure complete_item_return RPC with fixed search_path and caller authorization.
-- 4. Preserve existing data, schema structures, and legitimate claim workflows.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Hardened item_claims INSERT Policy
-- ------------------------------------------------------------------------------
-- Drop the overly permissive insert policy from initial migration
DROP POLICY IF EXISTS "Claimants can submit claims for their lost reports" ON public.item_claims;
DROP POLICY IF EXISTS "Claimants can submit pending claims for their lost reports" ON public.item_claims;

-- Create hardened policy:
-- Allows authenticated claimants to insert claims ONLY under strict initial state constraints:
-- a) Caller must be the claimant (claimant_id = auth.uid())
-- b) Initial status can ONLY be 'pending' or 'under_review' (NEVER 'approved', 'completed', etc.)
-- c) Privileged review fields CANNOT be set at creation (reviewed_by, reviewed_at, admin_notes must be NULL)
-- d) Claimant must own an active 'open' report of type 'lost'
-- e) Target must be an active 'open' report of type 'found' and reported by someone else
CREATE POLICY "Claimants can submit pending claims for their lost reports"
ON public.item_claims FOR INSERT
TO authenticated
WITH CHECK (
    -- 1. Must be the claimant
    claimant_id = auth.uid()
    -- 2. Initial status can ONLY be 'pending' or 'under_review'
    AND status IN ('pending', 'under_review')
    -- 3. Privileged review fields cannot be assigned at creation
    AND reviewed_by IS NULL
    AND reviewed_at IS NULL
    AND admin_notes IS NULL
    -- 4. Lost item must belong to the claimant and be open
    AND EXISTS (
        SELECT 1 FROM public.items l
        WHERE l.id = lost_item_id
          AND l.user_id = auth.uid()
          AND l.item_type = 'lost'
          AND l.status = 'open'
    )
    -- 5. Found item must be an open report from a different user
    AND EXISTS (
        SELECT 1 FROM public.items f
        WHERE f.id = found_item_id
          AND f.item_type = 'found'
          AND f.status = 'open'
          AND f.user_id <> auth.uid()
    )
);

-- ------------------------------------------------------------------------------
-- 2. Ensure No Direct UPDATE by Ordinary Users on item_claims or item_handovers
-- ------------------------------------------------------------------------------
-- Re-affirm that direct client update policies remain dropped
DROP POLICY IF EXISTS "Participants can update their claims" ON public.item_claims;
DROP POLICY IF EXISTS "Participants can update handover coordination" ON public.item_handovers;

-- Ensure Admins have full access to item_claims via trusted server-managed role
DROP POLICY IF EXISTS "Admins have full access to item_claims" ON public.item_claims;
CREATE POLICY "Admins have full access to item_claims"
ON public.item_claims
FOR ALL
TO authenticated
USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'security_reviewer')
)
WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'security_reviewer')
);

-- Ensure Admins have full access to item_handovers via trusted server-managed role
DROP POLICY IF EXISTS "Admins have full access to item_handovers" ON public.item_handovers;
CREATE POLICY "Admins have full access to item_handovers"
ON public.item_handovers
FOR ALL
TO authenticated
USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'security_reviewer')
)
WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'security_reviewer')
);

-- ------------------------------------------------------------------------------
-- 3. Hardened complete_item_return Database Function (RPC)
-- ------------------------------------------------------------------------------
-- Adds explicit search_path mitigation and caller authorization check
CREATE OR REPLACE FUNCTION public.complete_item_return(
    p_claim_id UUID,
    p_handover_id UUID
)
RETURNS JSONB AS $$
DECLARE
    v_claim RECORD;
    v_handover RECORD;
    v_caller UUID;
    v_is_admin BOOLEAN;
BEGIN
    v_caller := auth.uid();
    v_is_admin := (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'security_reviewer')
                  OR auth.role() = 'service_role';

    -- Caller authorization check:
    -- If invoked under authenticated user context (not service_role/internal),
    -- caller must be an authorized participant in the claim or a verified admin.
    IF v_caller IS NOT NULL AND NOT v_is_admin THEN
        IF NOT public.is_claim_participant(p_claim_id, v_caller) THEN
            RETURN jsonb_build_object(
                'success', false,
                'error', 'Unauthorized: Caller is not a participant in this return workflow'
            );
        END IF;
    END IF;

    -- 1. Lock claim record for update
    SELECT * INTO v_claim
    FROM public.item_claims
    WHERE id = p_claim_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Claim record not found');
    END IF;

    -- 2. Lock handover record for update
    SELECT * INTO v_handover
    FROM public.item_handovers
    WHERE id = p_handover_id AND claim_id = p_claim_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Handover record not found');
    END IF;

    -- 3. Verify dual confirmation
    IF v_handover.finder_confirmed_at IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Finder has not confirmed handover');
    END IF;

    IF v_handover.claimant_confirmed_at IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Claimant has not confirmed receipt');
    END IF;

    -- 4. Verify admin review if high-value or disputed
    IF v_claim.requires_admin_review AND (v_claim.reviewed_by IS NULL OR v_claim.status <> 'approved') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Claim requires authorized admin approval before completion');
    END IF;

    -- 5. Mark handover completed
    UPDATE public.item_handovers
    SET status = 'completed',
        completed_at = timezone('utc'::text, now())
    WHERE id = p_handover_id;

    -- 6. Mark claim completed
    UPDATE public.item_claims
    SET status = 'completed'
    WHERE id = p_claim_id;

    -- 7. Mark both items as returned
    UPDATE public.items
    SET status = 'returned'
    WHERE id IN (v_claim.found_item_id, v_claim.lost_item_id);

    -- 8. Cancel any other pending claims for this found item
    UPDATE public.item_claims
    SET status = 'cancelled',
        decision_reason = 'Another claim was successfully verified and completed'
    WHERE found_item_id = v_claim.found_item_id
      AND id <> p_claim_id
      AND status IN ('pending', 'under_review', 'disputed');

    RETURN jsonb_build_object(
        'success', true,
        'claim_id', p_claim_id,
        'status', 'completed',
        'message', 'Item return successfully verified and finalized'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;
