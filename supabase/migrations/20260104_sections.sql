-- Create sections table
create table if not exists sections (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references projects(id) on delete cascade not null,
  name text not null,
  order_index integer default 0,
  created_at timestamp with time zone default now()
);

-- Add section_id to tasks
alter table tasks add column if not exists section_id uuid references sections(id) on delete set null;

-- Enable RLS
alter table sections enable row level security;

-- Policies
create policy "Users can view sections of their projects"
on sections for select
using (
  exists (
    select 1 from projects
    where projects.id = sections.project_id
    and projects.user_id = auth.uid()
  )
);

create policy "Users can insert sections to their projects"
on sections for insert
with check (
  exists (
    select 1 from projects
    where projects.id = sections.project_id
    and projects.user_id = auth.uid()
  )
);

create policy "Users can update sections of their projects"
on sections for update
using (
  exists (
    select 1 from projects
    where projects.id = sections.project_id
    and projects.user_id = auth.uid()
  )
);

create policy "Users can delete sections of their projects"
on sections for delete
using (
  exists (
    select 1 from projects
    where projects.id = sections.project_id
    and projects.user_id = auth.uid()
  )
);
