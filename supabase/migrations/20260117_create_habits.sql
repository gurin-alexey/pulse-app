-- Create habits table
create table if not exists habits (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  name text not null,
  emoji text,
  color text,
  is_archived boolean default false,
  order_index integer default 0,
  created_at timestamp with time zone default now()
);

-- Enable RLS
alter table habits enable row level security;

-- Policies
create policy "Users can view their own habits"
on habits for select
using (auth.uid() = user_id);

create policy "Users can insert their own habits"
on habits for insert
with check (auth.uid() = user_id);

create policy "Users can update their own habits"
on habits for update
using (auth.uid() = user_id);

create policy "Users can delete their own habits"
on habits for delete
using (auth.uid() = user_id);

-- Indexes
create index if not exists habits_user_id_idx on habits(user_id);
create index if not exists habits_user_archived_idx on habits(user_id, is_archived);
create index if not exists habits_user_order_idx on habits(user_id, order_index);
