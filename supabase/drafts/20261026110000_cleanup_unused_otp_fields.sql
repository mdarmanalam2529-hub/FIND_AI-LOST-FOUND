-- ==============================================================================
-- Migration: 20261026110000_cleanup_unused_otp_fields.sql
-- Project: FindAI - University Lost-and-Found Platform
-- Purpose: Documentation / Optional Future Cleanup for Unused Handover OTP Fields
--
-- STATUS: DRAFT ONLY - DO NOT APPLY AUTOMATICALLY TO PRODUCTION DATABASE
--
-- Context:
-- Handover verification has transitioned to a direct dual-confirmation model
-- (Finder confirms handed over, Claimant independently confirms receipt).
-- Physical OTP verification has been removed from active application workflows.
--
-- Safety Notice:
-- In accordance with database safety constraints, existing columns and incident records
-- are preserved. This script documents how database administrators may optionally prune
-- unused columns in a future scheduled maintenance window after confirming no historical
-- audit dependency remains.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Optional Drop of Unused OTP Columns from public.item_handovers
-- ------------------------------------------------------------------------------
/*
ALTER TABLE public.item_handovers
    DROP COLUMN IF EXISTS otp_hash,
    DROP COLUMN IF EXISTS otp_salt,
    DROP COLUMN IF EXISTS otp_expires_at,
    DROP COLUMN IF EXISTS otp_attempts,
    DROP COLUMN IF EXISTS otp_verified_at;
*/

-- ------------------------------------------------------------------------------
-- 2. Clean Incident Type Check Constraint (Optional)
-- If administrators wish to remove historical OTP incident types from the check constraint:
-- ------------------------------------------------------------------------------
/*
DO $$
BEGIN
    ALTER TABLE public.handover_incidents 
        DROP CONSTRAINT IF EXISTS handover_incidents_incident_type_check;

    ALTER TABLE public.handover_incidents 
        ADD CONSTRAINT handover_incidents_incident_type_check CHECK (incident_type IN (
            'unauthorized_attempt',
            'premature_confirmation',
            'conflicting_claims',
            'unusual_attempt_burst'
        ));
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;
*/

-- ------------------------------------------------------------------------------
-- 3. Retained Security & Handover Hold Attributes in public.item_handovers
-- The following columns remain actively used and must NOT be removed:
-- - status ('scheduled', 'handover_pending', 'in_progress', 'completed', 'suspended', 'cancelled')
-- - is_flagged (BOOLEAN)
-- - flagged_reason (TEXT)
-- - finder_confirmed_at (TIMESTAMPTZ)
-- - claimant_confirmed_at (TIMESTAMPTZ)
-- - completed_at (TIMESTAMPTZ)
-- - proposed_location (TEXT)
-- - scheduled_at (TIMESTAMPTZ)
-- ------------------------------------------------------------------------------
