-- 앨범 등록 요청 (Digging 의 + Request)
-- Supabase 대시보드 → SQL Editor 에 통째로 붙여넣고 Run. (20261012_profiles_roles.sql 을 먼저 실행해야 함)
--
-- album_requests: 로그인한 사용자가 "이 판도 올려 주세요" 하고 남기는 요청
-- - status: pending(대기) → added(등록됨, album_slug 로 연결) | declined(반려, admin_note 로 이유)
-- - 사용자는 본인 요청만 쓰고 읽음. 같은 앨범을 대기 중에 두 번 요청할 수 없음
-- - 관리자(is_admin)는 전부 읽고 상태를 바꿀 수 있음 (관리자 화면은 서버에서 처리)

-- 관리자 화면에서 누가 요청했는지 보이도록 profiles 에 이메일도 둠
alter table public.profiles add column if not exists email text;
update public.profiles p set email = u.email from auth.users u where u.id = p.id and p.email is distinct from u.email;
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, email, display_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create table if not exists public.album_requests (
  id          bigint generated always as identity primary key,
  user_id     uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  title       text not null check (char_length(title) between 1 and 200),
  artist      text not null check (char_length(artist) between 1 and 200),
  link        text check (link is null or char_length(link) <= 500),
  note        text check (note is null or char_length(note) <= 1000),
  status      text not null default 'pending' check (status in ('pending', 'added', 'declined')),
  album_slug  text,
  admin_note  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists album_requests_user_idx on public.album_requests (user_id, created_at desc);
create index if not exists album_requests_status_idx on public.album_requests (status, created_at desc);
-- 같은 사람이 같은 앨범을 대기 중에 또 요청하지 못하게
create unique index if not exists album_requests_pending_once
  on public.album_requests (user_id, lower(title), lower(artist)) where status = 'pending';

alter table public.album_requests enable row level security;

drop policy if exists "requests insert own" on public.album_requests;
drop policy if exists "requests select own or admin" on public.album_requests;
drop policy if exists "requests update admin" on public.album_requests;

-- 사용자: 본인 이름으로, 대기 상태로만 만들 수 있음 (관리자 칸은 비워 둬야 함)
create policy "requests insert own" on public.album_requests
  for insert to authenticated
  with check ((select auth.uid()) = user_id and status = 'pending' and album_slug is null and admin_note is null);
create policy "requests select own or admin" on public.album_requests
  for select to authenticated using ((select auth.uid()) = user_id or public.is_admin());
create policy "requests update admin" on public.album_requests
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

grant select, insert on public.album_requests to authenticated;
grant update on public.album_requests to authenticated;
