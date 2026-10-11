-- 내 판 (소장 / 위시리스트)
-- Supabase 대시보드 → SQL Editor 에 통째로 붙여넣고 Run.
-- 한 앨범은 한 사람에게 'owned'(소장) 또는 'wishlist'(위시리스트) 중 하나 — 위시리스트에 있던 판을 사면 owned 로 옮겨짐.

-- albums.id 의 타입(uuid / bigint …)을 그대로 따라가도록 동적으로 만든다
do $$
declare album_id_type text;
begin
  select format_type(atttypid, atttypmod) into album_id_type
  from pg_attribute where attrelid = 'public.albums'::regclass and attname = 'id';

  execute format($f$
    create table if not exists public.user_albums (
      user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
      album_id   %s   not null references public.albums(id) on delete cascade,
      kind       text not null check (kind in ('owned', 'wishlist')),
      created_at timestamptz not null default now(),
      primary key (user_id, album_id)
    )$f$, album_id_type);
end $$;

create index if not exists user_albums_shelf_idx on public.user_albums (user_id, kind, created_at desc);

-- 본인 행만 읽고 쓸 수 있게
alter table public.user_albums enable row level security;

drop policy if exists "user_albums select own" on public.user_albums;
drop policy if exists "user_albums insert own" on public.user_albums;
drop policy if exists "user_albums update own" on public.user_albums;
drop policy if exists "user_albums delete own" on public.user_albums;

create policy "user_albums select own" on public.user_albums
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "user_albums insert own" on public.user_albums
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "user_albums update own" on public.user_albums
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "user_albums delete own" on public.user_albums
  for delete to authenticated using ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.user_albums to authenticated;
