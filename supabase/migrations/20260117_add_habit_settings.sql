-- Add settings columns to habits
alter table habits
  add column if not exists description text,
  add column if not exists frequency_type text default 'daily' check (frequency_type in ('daily', 'weekly', 'interval')),
  add column if not exists days_of_week integer[],
  add column if not exists interval_days integer,
  add column if not exists goal_per_day integer default 1,
  add column if not exists reminder_enabled boolean default false,
  add column if not exists reminder_time time;
