-- 사용자 프로필 + 권한(role)
-- Supabase 대시보드 → SQL Editor 에 통째로 붙여넣고 Run. (여러 번 실행해도 안전)
--
-- profiles: 로그인한 사용자 1명당 1줄. role = 'user'(기본) | 'admin'
-- - Google 로 처음 로그인하면 트리거가 자동으로 만들어 줌 (이미 가입한 사람은 아래에서 한 번에 채움)
-- - 본인 줄만 읽을 수 있고, role 은 누구도 앱에서 바꿀 수 없음 (SQL Editor 에서만)
-- - is_admin(): 지금 로그인한 사람이 관리자인지 — 다음 단계(News·Request)의 RLS 에서 씀

create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  role         text not null default 'user' check (role in ('user', 'admin')),
  display_name text,
  avatar_url   text,
  created_at   timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles select own" on public.profiles;
create policy "profiles select own" on public.profiles
  for select to authenticated using ((select auth.uid()) = id);
-- insert / update / delete 정책 없음 = 앱(브라우저)에서는 못 바꿈. 서버(서비스 키)·SQL Editor 에서만

grant select on public.profiles to authenticated;

-- 새 사용자 → 프로필 자동 생성 (Google 이름·사진 복사)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 이미 가입한 사용자도 프로필 채우기
insert into public.profiles (id, display_name, avatar_url)
select u.id,
       coalesce(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name'),
       coalesce(u.raw_user_meta_data ->> 'avatar_url', u.raw_user_meta_data ->> 'picture')
from auth.users u
on conflict (id) do nothing;

-- 지금 로그인한 사람이 관리자인가 (RLS 정책에서 재귀 없이 쓰려고 security definer)
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer set search_path = ''
as $$
  select exists (select 1 from public.profiles where id = (select auth.uid()) and role = 'admin');
$$;
grant execute on function public.is_admin() to anon, authenticated;

-- ▼ 관리자 지정: 아래 이메일을 본인 Google 이메일로 바꾸고 이 줄의 주석(--)을 지운 뒤 Run
-- update public.profiles set role = 'admin' where id = (select id from auth.users where email = 'YOUR_EMAIL@gmail.com');
