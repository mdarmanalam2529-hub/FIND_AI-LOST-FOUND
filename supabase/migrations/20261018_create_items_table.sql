-- ==============================================================================
-- Migration: Create Items Table with Row Level Security (RLS)
-- Project: FindAI - AI Lost-and-Found Matcher
-- ==============================================================================

-- 1. Create items table
CREATE TABLE IF NOT EXISTS public.items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    item_type TEXT NOT NULL CHECK (item_type IN ('lost', 'found')),
    title TEXT NOT NULL CHECK (char_length(trim(title)) >= 3),
    description TEXT NOT NULL CHECK (char_length(trim(description)) >= 5),
    category TEXT NOT NULL CHECK (category IN ('electronics', 'keys-wallets', 'clothing', 'documents', 'jewelry', 'other')),
    color TEXT,
    location_description TEXT NOT NULL CHECK (char_length(trim(location_description)) >= 2),
    incident_date DATE NOT NULL DEFAULT CURRENT_DATE,
    image_path TEXT,
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'matched', 'returned', 'closed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2. Create performance indexes
CREATE INDEX IF NOT EXISTS idx_items_user_id ON public.items(user_id);
CREATE INDEX IF NOT EXISTS idx_items_type_status ON public.items(item_type, status);
CREATE INDEX IF NOT EXISTS idx_items_category ON public.items(category);
CREATE INDEX IF NOT EXISTS idx_items_created_at ON public.items(created_at DESC);

-- 3. Create automatic updated_at timestamp trigger function
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_items_updated_at ON public.items;
CREATE TRIGGER set_items_updated_at
    BEFORE UPDATE ON public.items
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if previously applied to prevent duplicate errors
DROP POLICY IF EXISTS "Authenticated users can read open or own items" ON public.items;
DROP POLICY IF EXISTS "Users can insert their own reports" ON public.items;
DROP POLICY IF EXISTS "Users can update their own reports" ON public.items;
DROP POLICY IF EXISTS "Users can delete their own reports" ON public.items;

-- Policy 1: Authenticated users can view open reports or their own reports
CREATE POLICY "Authenticated users can read open or own items"
    ON public.items
    FOR SELECT
    TO authenticated
    USING (status = 'open' OR auth.uid() = user_id);

-- Policy 2: Authenticated users can insert reports only under their own user ID
CREATE POLICY "Users can insert their own reports"
    ON public.items
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

-- Policy 3: Users can update only their own reports
CREATE POLICY "Users can update their own reports"
    ON public.items
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Policy 4: Users can delete only their own reports
CREATE POLICY "Users can delete their own reports"
    ON public.items
    FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);
