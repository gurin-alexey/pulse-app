-- Drop the table if it already exists to ensure a clean slate
DROP TABLE IF EXISTS public.task_occurrences;

-- B. Create the new table
create table public.task_occurrences (
  id uuid default gen_random_uuid() primary key,
  task_id uuid references public.tasks(id) on delete cascade not null,
  original_date date not null, -- The date this instance was generated for (from RRule)
  status text check (status in ('completed', 'skipped', 'archived')) not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  
  -- Ensure one status record per instance per task
  unique(task_id, original_date) 
);

-- Enable RLS
alter table public.task_occurrences enable row level security;

-- Policies
create policy "Users can view their own task occurrences"
  on public.task_occurrences for select
  using (auth.uid() = (select user_id from public.tasks where id = task_occurrences.task_id));

create policy "Users can insert their own task occurrences"
  on public.task_occurrences for insert
  with check (auth.uid() = (select user_id from public.tasks where id = task_occurrences.task_id));

create policy "Users can update their own task occurrences"
  on public.task_occurrences for update
  using (auth.uid() = (select user_id from public.tasks where id = task_occurrences.task_id));

create policy "Users can delete their own task occurrences"
  on public.task_occurrences for delete
  using (auth.uid() = (select user_id from public.tasks where id = task_occurrences.task_id));
