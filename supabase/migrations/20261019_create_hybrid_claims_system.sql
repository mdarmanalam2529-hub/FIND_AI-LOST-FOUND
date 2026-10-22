-- ==============================================================================
-- Migration: Create Hybrid Claim & Return System Tables with RLS & Safe Return RPC
-- Project: FindAI - AI Lost-and-Found Matcher
-- ==============================================================================

-- 1. Table: item_claims
-- Tracks claims submitted by lost-report owners for found-item reports
CREATE TABLE IF NOT EXISTS public.item_claims (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    found_item_id UUID NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
    lost_item_id UUID NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
    claimant_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
        'pending',
        'under_review',
        'approved',
        'rejected',
        'disputed',
        'cancelled',
        'completed'
    )),
    claim_message TEXT NOT NULL CHECK (char_length(trim(claim_message)) >= 5),
    private_proof JSONB NOT NULL DEFAULT '{}'::jsonb,
    requires_admin_review BOOLEAN NOT NULL DEFAULT false,
    reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    decision_reason TEXT,
    admin_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT chk_claims_distinct_items CHECK (found_item_id <> lost_item_id)
);

-- Indexes for claim lookups
CREATE INDEX IF NOT EXISTS idx_claims_found_item ON public.item_claims(found_item_id);
CREATE INDEX IF NOT EXISTS idx_claims_lost_item ON public.item_claims(lost_item_id);
CREATE INDEX IF NOT EXISTS idx_claims_claimant ON public.item_claims(claimant_id);
CREATE INDEX IF NOT EXISTS idx_claims_status ON public.item_claims(status);

-- 2. Table: item_handovers
-- Manages private physical handover coordination between finder and claimant
CREATE TABLE IF NOT EXISTS public.item_handovers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    claim_id UUID NOT NULL UNIQUE REFERENCES public.item_claims(id) ON DELETE CASCADE,
    proposed_location TEXT NOT NULL CHECK (char_length(trim(proposed_location)) >= 2),
    scheduled_at TIMESTAMPTZ,
    finder_confirmed_at TIMESTAMPTZ,
    claimant_confirmed_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'proposed' CHECK (status IN (
        'proposed',
        'scheduled',
        'handover_pending',
        'completed',
        'cancelled'
    )),
    notes TEXT,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_handovers_claim_id ON public.item_handovers(claim_id);
CREATE INDEX IF NOT EXISTS idx_handovers_status ON public.item_handovers(status);

-- 3. Table: user_notifications
-- In-app notifications alerting users of claim decisions, handovers, and return milestones
CREATE TABLE IF NOT EXISTS public.user_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN (
        'claim_created',
        'claim_approved',
        'claim_rejected',
        'claim_under_review',
        'claim_disputed',
        'handover_scheduled',
        'handover_confirmed',
        'item_returned',
        'admin_action'
    )),
    claim_id UUID REFERENCES public.item_claims(id) ON DELETE CASCADE,
    message TEXT NOT NULL CHECK (char_length(trim(message)) >= 2),
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON public.user_notifications(recipient_id, read_at);

-- 4. Automatic updated_at triggers
DROP TRIGGER IF EXISTS set_claims_updated_at ON public.item_claims;
CREATE TRIGGER set_claims_updated_at
    BEFORE UPDATE ON public.item_claims
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_handovers_updated_at ON public.item_handovers;
CREATE TRIGGER set_handovers_updated_at
    BEFORE UPDATE ON public.item_handovers
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- 5. Helper Function: Check if user is an authorized claim participant
-- Participants include: Claimant, Finder of the found report, or system Admin
CREATE OR REPLACE FUNCTION public.is_claim_participant(p_claim_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 
        FROM public.item_claims c
        JOIN public.items f ON f.id = c.found_item_id
        WHERE c.id = p_claim_id
          AND (c.claimant_id = p_user_id OR f.user_id = p_user_id)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Enable Row Level Security (RLS)
ALTER TABLE public.item_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.item_handovers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_notifications ENABLE ROW LEVEL SECURITY;

-- Clean up any existing policies
DROP POLICY IF EXISTS "Participants can view their claims" ON public.item_claims;
DROP POLICY IF EXISTS "Claimants can submit claims for their lost reports" ON public.item_claims;
DROP POLICY IF EXISTS "Participants can view handover coordination" ON public.item_handovers;
DROP POLICY IF EXISTS "Users can view and manage their own notifications" ON public.user_notifications;

-- Policy: item_claims SELECT
-- Allowed if caller is claimant OR caller is finder who reported the found item
CREATE POLICY "Participants can view their claims"
ON public.item_claims FOR SELECT
TO authenticated
USING (
    claimant_id = auth.uid()
    OR EXISTS (
        SELECT 1 FROM public.items f
        WHERE f.id = item_claims.found_item_id
          AND f.user_id = auth.uid()
    )
);

-- Policy: item_claims INSERT
-- Claimant must be the authenticated user and must own the lost_item_id
CREATE POLICY "Claimants can submit claims for their lost reports"
ON public.item_claims FOR INSERT
TO authenticated
WITH CHECK (
    claimant_id = auth.uid()
    AND EXISTS (
        SELECT 1 FROM public.items l
        WHERE l.id = lost_item_id
          AND l.user_id = auth.uid()
          AND l.item_type = 'lost'
    )
);

-- Policy: item_handovers SELECT
-- Allowed only if caller is participant in the associated claim
CREATE POLICY "Participants can view handover coordination"
ON public.item_handovers FOR SELECT
TO authenticated
USING (
    public.is_claim_participant(claim_id, auth.uid())
);

-- Policy: user_notifications ALL
-- Users can only view and update their own notifications
CREATE POLICY "Users can view and manage their own notifications"
ON public.user_notifications FOR ALL
TO authenticated
USING (recipient_id = auth.uid())
WITH CHECK (recipient_id = auth.uid());

-- 7. Atomic Safe Return Completion Database Function (RPC)
-- Ensures dual confirmation + required admin checks before completing return
CREATE OR REPLACE FUNCTION public.complete_item_return(
    p_claim_id UUID,
    p_handover_id UUID
)
RETURNS JSONB AS $$
DECLARE
    v_claim RECORD;
    v_handover RECORD;
BEGIN
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
$$ LANGUAGE plpgsql SECURITY DEFINER;
