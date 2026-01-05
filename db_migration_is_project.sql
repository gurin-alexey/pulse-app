-- Migration to add is_project to tasks table
ALTER TABLE IF EXISTS tasks 
ADD COLUMN IF NOT EXISTS is_project BOOLEAN DEFAULT false;

-- Comment to explain the purpose
COMMENT ON COLUMN tasks.is_project IS 'If true, the task is considered a multi-step project container for subtasks.';
