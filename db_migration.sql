-- Add new columns to tasks table for soft delete, completion tracking and manual sorting

ALTER TABLE tasks 
ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL,
ADD COLUMN IF NOT EXISTS completed_at timestamptz DEFAULT NULL,
ADD COLUMN IF NOT EXISTS sort_order float DEFAULT 0;

-- Optional: Add index for performance on deleted_at filtering
CREATE INDEX IF NOT EXISTS idx_tasks_deleted_at ON tasks(deleted_at);

-- Comments for documentation
COMMENT ON COLUMN tasks.deleted_at IS 'Timestamp for soft delete. If NULL, task is active.';
COMMENT ON COLUMN tasks.completed_at IS 'Timestamp when the task was marked completed.';
COMMENT ON COLUMN tasks.sort_order IS 'Float value for custom drag-and-drop ordering.';
