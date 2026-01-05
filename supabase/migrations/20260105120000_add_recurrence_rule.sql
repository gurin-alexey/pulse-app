-- Add recurrence_rule column to tasks table
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS recurrence_rule TEXT;

COMMENT ON COLUMN tasks.recurrence_rule IS 'RFC 5545 recurrence rule string (e.g. FREQ=WEEKLY;BYDAY=MO)';
