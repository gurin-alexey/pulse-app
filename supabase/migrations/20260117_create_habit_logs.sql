-- Create habit_logs table
create table if not exists habit_logs (
  id uuid default gen_random_uuid() primary key,
  habit_id uuid references habits(id) on delete cascade not null,
  user_id uuid references auth.users not null,
  log_date date not null,
  status text not null check (status in ('done', 'missed', 'skipped')),
  note text,
  created_at timestamp with time zone default now()
);

-- Ensure one log per habit per day
create unique index if not exists habit_logs_unique on habit_logs(habit_id, log_date);

-- Indexes
create index if not exists habit_logs_user_id_idx on habit_logs(user_id);
create index if not exists habit_logs_user_date_idx on habit_logs(user_id, log_date);
create index if not exists habit_logs_habit_date_idx on habit_logs(habit_id, log_date);

-- Enable RLS
alter table habit_logs enable row level security;

-- Policies
create policy "Users can view their own habit logs"
on habit_logs for select
using (auth.uid() = user_id);

create policy "Users can insert their own habit logs"
on habit_logs for insert
with check (auth.uid() = user_id);

create policy "Users can update their own habit logs"
on habit_logs for update
using (auth.uid() = user_id);

create policy "Users can delete their own habit logs"
on habit_logs for delete
using (auth.uid() = user_id);
