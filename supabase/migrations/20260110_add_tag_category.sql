-- Add category column to tags table
ALTER TABLE tags 
ADD COLUMN IF NOT EXISTS category text DEFAULT NULL;

-- Optional: Add check constraint if we want to enforce specific values, usually better to leave open or handle in app logic for flexibility
-- ALTER TABLE tags ADD CONSTRAINT tags_category_check CHECK (category IN ('place', 'energy', 'time', 'people'));
