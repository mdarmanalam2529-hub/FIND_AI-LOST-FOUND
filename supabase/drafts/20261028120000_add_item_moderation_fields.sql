-- ==============================================================================
-- Migration Draft: 20261028120000_add_item_moderation_fields.sql
-- Project: FindAI - University Lost-and-Found Platform
-- Phase 2: Lost-and-Found Report Moderation
--
-- STATUS: DRAFT ONLY - DO NOT APPLY AUTOMATICALLY TO PRODUCTION DATABASE
--
-- Objective:
-- Documents optional future column additions on public.items to support direct
-- table-level caching of moderation indicators, if required beyond admin_audit_logs.
--
-- Safety Notice:
-- Phase 2 active implementation relies on public.items.status ('open', 'matched',
-- 'returned', 'closed'), public.admin_audit_logs, and public.handover_incidents
-- without modifying the active production table schema.
-- ==============================================================================

/*
-- 1. Add moderation columns to public.items (Optional future evolution)
ALTER TABLE public.items
    ADD COLUMN IF NOT EXISTS moderation_status VARCHAR(32) NOT NULL DEFAULT 'approved'
        CHECK (moderation_status IN ('approved', 'flagged', 'restricted', 'rejected', 'duplicate')),
    ADD COLUMN IF NOT EXISTS moderation_notes TEXT,
    ADD COLUMN IF NOT EXISTS moderated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS moderated_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS duplicate_of_id UUID REFERENCES public.items(id) ON DELETE SET NULL;

-- 2. Performance indexes for moderated item queries
CREATE INDEX IF NOT EXISTS idx_items_moderation_status
    ON public.items(moderation_status);

CREATE INDEX IF NOT EXISTS idx_items_duplicate_of_id
    ON public.items(duplicate_of_id);
*/

