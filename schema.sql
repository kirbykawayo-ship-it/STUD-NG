-- STUDING database schema for Supabase
-- Run this entire file in Supabase Dashboard > SQL Editor > New query.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique check (char_length(username) between 2 and 24),
  bio text not null default '' check (char_length(bio) <= 160),
  created_at timestamptz not null default now()
);
create table if not exists public.study_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  minutes integer not null check (minutes between 1 and 1440),
  subject text check (subject is null or char_length(subject) <= 80),
  created_at timestamptz not null default now()
);
create table if not exists public.likes (
  id uuid primary key default gen_random_uuid(),
  log_id uuid not null references public.study_logs(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(log_id,user_id)
);
create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  log_id uuid not null references public.study_logs(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 300),
  created_at timestamptz not null default now()
);
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.study_logs enable row level security;
alter table public.likes enable row level security;
alter table public.comments enable row level security;
alter table public.messages enable row level security;

drop policy if exists "Profiles are public to read" on public.profiles;
create policy "Profiles are public to read" on public.profiles for select using (true);
drop policy if exists "Users create own profile" on public.profiles;
create policy "Users create own profile" on public.profiles for insert to authenticated with check (auth.uid() = id);
drop policy if exists "Users update own profile" on public.profiles;
create policy "Users update own profile" on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "Study logs are public to read" on public.study_logs;
create policy "Study logs are public to read" on public.study_logs for select using (true);
drop policy if exists "Users create own study logs" on public.study_logs;
create policy "Users create own study logs" on public.study_logs for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "Users delete own study logs" on public.study_logs;
create policy "Users delete own study logs" on public.study_logs for delete to authenticated using (auth.uid() = user_id);

drop policy if exists "Likes are public to read" on public.likes;
create policy "Likes are public to read" on public.likes for select using (true);
drop policy if exists "Users like as themselves" on public.likes;
create policy "Users like as themselves" on public.likes for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "Users remove own likes" on public.likes;
create policy "Users remove own likes" on public.likes for delete to authenticated using (auth.uid() = user_id);

drop policy if exists "Comments are public to read" on public.comments;
create policy "Comments are public to read" on public.comments for select using (true);
drop policy if exists "Users create own comments" on public.comments;
create policy "Users create own comments" on public.comments for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "Users delete own comments" on public.comments;
create policy "Users delete own comments" on public.comments for delete to authenticated using (auth.uid() = user_id);

drop policy if exists "Messages are public to read" on public.messages;
create policy "Messages are public to read" on public.messages for select using (true);
drop policy if exists "Authenticated users send messages as themselves" on public.messages;
create policy "Authenticated users send messages as themselves" on public.messages for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "Users delete own messages" on public.messages;
create policy "Users delete own messages" on public.messages for delete to authenticated using (auth.uid() = user_id);

-- Create a profile automatically for new sign-ups. Username is taken from sign-up metadata,
-- with a unique fallback if the chosen name is already taken.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare chosen_name text;
begin
  chosen_name := coalesce(nullif(new.raw_user_meta_data ->> 'username',''), split_part(coalesce(new.email,''),'@',1), 'student');
  chosen_name := left(regexp_replace(chosen_name, '[^a-zA-Z0-9_一-龯ぁ-んァ-ヶー-]', '', 'g'), 24);
  if char_length(chosen_name) < 2 then chosen_name := 'student'; end if;
  if exists (select 1 from public.profiles where username = chosen_name) then
    chosen_name := left(chosen_name, 17) || '_' || substr(replace(new.id::text,'-',''),1,6);
  end if;
  insert into public.profiles(id, username) values (new.id, chosen_name);
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

-- Enable Realtime for shared chat and study feed updates (safe to run if already included).
do $$ begin
  alter publication supabase_realtime add table public.study_logs;
exception when duplicate_object then null; when others then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.messages;
exception when duplicate_object then null; when others then null; end $$;
