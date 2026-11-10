-- ==============================================================================
-- Migration: 20261101100000_create_community_item_reports.sql
-- Project: FindAI - University Lost-and-Found Platform
-- Milestone: Campus Community Feed & Abuse Reporting System
--
-- Objective:
-- 1. Create public.community_item_reports table for student abuse reporting
--    (inappropriate content, misleading info, duplicate listing, suspicious activity).
-- 2. Enforce unique constraint (item_id, reporter_id) to prevent duplicate reports.
-- 3. Enable Row Level Security (RLS):
--    - Students can insert reports only under their own user ID.
--    - Students can view only their own submitted reports.
--    - University staff/admins can view and update all reports.
-- 4. Automatically update timestamps with handle_updated_at().
-- ==============================================================================

-- 1. Create community item reports table
CREATE TABLE IF NOT EXISTS public.community_item_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id UUID NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
    reporter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    reason TEXT NOT NULL CHECK (reason IN (
        'inappropriate',
        'incorrect_info',
        'duplicate',
        'suspicious',
        'spam',
        'other'
    )),
    details TEXT,
    evidence TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
        'pending',
        'reviewed',
        'dismissed',
        'actioned'
    )),
    admin_notes TEXT,
    reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_community_item_reporter UNIQUE (item_id, reporter_id)
);

-- 2. Performance indexes
CREATE INDEX IF NOT EXISTS idx_community_reports_item 
    ON public.community_item_reports (item_id);

CREATE INDEX IF NOT EXISTS idx_community_reports_reporter 
    ON public.community_item_reports (reporter_id);

CREATE INDEX IF NOT EXISTS idx_community_reports_status 
    ON public.community_item_reports (status);

CREATE INDEX IF NOT EXISTS idx_community_reports_created 
    ON public.community_item_reports (created_at DESC);

-- 3. Automatic updated_at trigger
DROP TRIGGER IF EXISTS set_community_reports_updated_at ON public.community_item_reports;
CREATE TRIGGER set_community_reports_updated_at
    BEFORE UPDATE ON public.community_item_reports
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.community_item_reports ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if previously applied
DROP POLICY IF EXISTS "Students can insert their own community reports" ON public.community_item_reports;
DROP POLICY IF EXISTS "Students can view their own community reports" ON public.community_item_reports;
DROP POLICY IF EXISTS "Admins have full access to community reports" ON public.community_item_reports;

-- Policy 1: Authenticated students can submit reports for items
CREATE POLICY "Students can insert their own community reports"
    ON public.community_item_reports
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = reporter_id);

-- Policy 2: Students can view their own submitted reports
CREATE POLICY "Students can view their own community reports"
    ON public.community_item_reports
    FOR SELECT
    TO authenticated
    USING (auth.uid() = reporter_id);

-- Policy 3: Staff and Admins can view and manage all reports
CREATE POLICY "Admins have full access to community reports"
    ON public.community_item_reports
    FOR ALL
    TO authenticated
    USING (
        (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'security_reviewer')
        OR (auth.jwt() -> 'user_metadata' ->> 'role') IN ('admin', 'security_reviewer')
    )
    WITH CHECK (
        (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'security_reviewer')
        OR (auth.jwt() -> 'user_metadata' ->> 'role') IN ('admin', 'security_reviewer')
    );

