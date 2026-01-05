create table if not exists user_settings (
    user_id uuid references auth.users not null primary key,
    theme text check (theme in ('light', 'dark', 'system')) default 'system',
    dashboard_layout jsonb default '{}'::jsonb,
    preferences jsonb default '{}'::jsonb,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

alter table user_settings enable row level security;

create policy "Users can view their own settings"
    on user_settings for select
    using (auth.uid() = user_id);

create policy "Users can update their own settings"
    on user_settings for update
    using (auth.uid() = user_id);

create policy "Users can insert their own settings"
    on user_settings for insert
    with check (auth.uid() = user_id);

-- Trigger to handle updated_at
create or replace function update_updated_at_column()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language plpgsql;

create trigger update_user_settings_updated_at
    before update on user_settings
    for each row
    execute function update_updated_at_column();
