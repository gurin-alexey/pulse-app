-- Add parent_id to tags table
ALTER TABLE tags 
ADD COLUMN parent_id UUID REFERENCES tags(id) ON DELETE CASCADE;

-- Create index for performance
CREATE INDEX idx_tags_parent_id ON tags(parent_id);
