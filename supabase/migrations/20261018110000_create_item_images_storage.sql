-- ==============================================================================
-- Migration: Create Private Storage Bucket for Item Images & Configure RLS
-- Project: FindAI - AI Lost-and-Found Matcher
-- Bucket: item-images (Private, Max 5MB, JPEG/PNG/WebP only)
-- ==============================================================================

-- 1. Create or update private storage bucket 'item-images'
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'item-images',
    'item-images',
    false, -- Private bucket: access requires signed URLs or authenticated RLS authorization
    5242880, -- 5 MB in bytes
    ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
    public = false,
    file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'];

-- 2. Clean up any existing policies on storage.objects for this bucket
DROP POLICY IF EXISTS "Authenticated users can read open report images or own images" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their own item images" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own item images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own item images" ON storage.objects;

-- 3. Policy: SELECT
-- Authenticated users can view images if:
-- a) The image belongs to their own report ({auth.uid()}/...), OR
-- b) The image is associated with an active 'open' report in public.items
CREATE POLICY "Authenticated users can read open report images or own images"
ON storage.objects FOR SELECT
TO authenticated
USING (
    bucket_id = 'item-images'
    AND (
        (storage.foldername(name))[1] = (auth.uid())::text
        OR EXISTS (
            SELECT 1 FROM public.items
            WHERE items.image_path = storage.objects.name
              AND items.status = 'open'
        )
    )
);

-- 4. Policy: INSERT
-- Authenticated users can only upload files into a folder matching their own user ID
CREATE POLICY "Users can upload their own item images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'item-images'
    AND (storage.foldername(name))[1] = (auth.uid())::text
);

-- 5. Policy: UPDATE
-- Authenticated users can only overwrite or update images in their own user folder
CREATE POLICY "Users can update their own item images"
ON storage.objects FOR UPDATE
TO authenticated
USING (
    bucket_id = 'item-images'
    AND (storage.foldername(name))[1] = (auth.uid())::text
)
WITH CHECK (
    bucket_id = 'item-images'
    AND (storage.foldername(name))[1] = (auth.uid())::text
);

-- 6. Policy: DELETE
-- Authenticated users can only delete images in their own user folder
CREATE POLICY "Users can delete their own item images"
ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id = 'item-images'
    AND (storage.foldername(name))[1] = (auth.uid())::text
);
