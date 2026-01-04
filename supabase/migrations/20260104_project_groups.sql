-- Create project_groups table
create table if not exists project_groups (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  name text not null,
  created_at timestamp with time zone default now()
);

-- Add group_id to projects
alter table projects add column if not exists group_id uuid references project_groups(id);

-- Enable RLS for project_groups
alter table project_groups enable row level security;

-- RLS Policies for project_groups
create policy "Users can view their own project groups"
on project_groups for select
using (auth.uid() = user_id);

create policy "Users can insert their own project groups"
on project_groups for insert
with check (auth.uid() = user_id);

create policy "Users can update their own project groups"
on project_groups for update
using (auth.uid() = user_id);

create policy "Users can delete their own project groups"
on project_groups for delete
using (auth.uid() = user_id);
