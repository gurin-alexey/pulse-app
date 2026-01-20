-- Add ON DELETE CASCADE to task_tags.task_id
-- First, drop the existing constraint if we can rely on its name.
-- Constraint names are usually auto-generated if not specified, but Supabase/Postgres naming convention is usually predictable: `table_column_fkey`.
-- For task_tags, it's likely `task_tags_task_id_fkey`.

ALTER TABLE task_tags
DROP CONSTRAINT IF EXISTS task_tags_task_id_fkey;

ALTER TABLE task_tags
ADD CONSTRAINT task_tags_task_id_fkey
FOREIGN KEY (task_id)
REFERENCES tasks(id)
ON DELETE CASCADE;
