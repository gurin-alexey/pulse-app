-- 1. Create the bucket 'task-assets' for storing task images
INSERT INTO storage.buckets (id, name, public)
VALUES ('task-assets', 'task-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Removed ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY; 
-- Usually it is already enabled by the system.

-- 2. Policy: Allow Public Read Access (Images in tasks should be visible)
-- Note: We use DO blocks or separate statements to handle existing policies to avoid errors if they exist, 
-- but standard CREATE POLICY IF NOT EXISTS syntax is not fully supported in all Postgres versions for policies.
-- A simple drop-then-create pattern is safer for migrations if you are okay with resetting them.

DROP POLICY IF EXISTS "Public Access" ON storage.objects;
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING ( bucket_id = 'task-assets' );

-- 3. Policy: Allow Authenticated Users to Upload
DROP POLICY IF EXISTS "Authenticated Users Upload" ON storage.objects;
CREATE POLICY "Authenticated Users Upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK ( bucket_id = 'task-assets' );

-- 4. Policy: Allow Users to Update their own files
DROP POLICY IF EXISTS "Users Update Own Files" ON storage.objects;
CREATE POLICY "Users Update Own Files"
ON storage.objects FOR UPDATE
TO authenticated
USING ( bucket_id = 'task-assets' AND auth.uid() = owner );

-- 5. Policy: Allow Users to Delete their own files
DROP POLICY IF EXISTS "Users Delete Own Files" ON storage.objects;
CREATE POLICY "Users Delete Own Files"
ON storage.objects FOR DELETE
TO authenticated
USING ( bucket_id = 'task-assets' AND auth.uid() = owner );
