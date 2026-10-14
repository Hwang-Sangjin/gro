-- 공개 컬렉션: 아이디(handle) + 공개 스위치
-- Supabase 대시보드 → SQL Editor 에 통째로 붙여넣고 Run. (여러 번 실행해도 안전)
--
-- - profiles.handle: 공개 주소에 쓰는 아이디 (/collection/<handle>). 가입할 때 이메일 @ 앞부분으로 자동 생성, 겹치면 숫자를 붙임
--   소문자·숫자·_·- 만, 3~24자, 처음과 끝은 소문자·숫자. 이메일은 어디에도 노출되지 않음
-- - profiles.collection_public: 기본 꺼짐. 켠 사람만 /collection/<handle> 로 보임
-- - 바꾸기: set_my_collection_share(공개 여부, 새 아이디) — 본인만
-- - 보기: public_collection(아이디) — 누구나 (공개한 사람만, 아이디와 판 목록만 돌려줌)

alter table public.profiles add column if not exists handle text;
alter table public.profiles add column if not exists collection_public boolean not null default false;
create unique index if not exists profiles_handle_key on public.profiles (handle);
alter table public.profiles drop constraint if exists profiles_handle_format;
alter table public.profiles add constraint profiles_handle_format
  check (handle is null or handle ~ '^[a-z0-9][a-z0-9_-]{1,22}[a-z0-9]$');

-- 씨앗(이메일 @ 앞부분 등) → 쓸 수 있는 아이디 (겹치면 2, 3 … 을 붙임)
create or replace function public.make_handle(seed text, me uuid default null)
returns text
language plpgsql
security definer set search_path = ''
as $$
declare
  base text;
  candidate text;
  n int := 1;
begin
  base := regexp_replace(lower(coalesce(seed, '')), '[^a-z0-9_-]+', '', 'g');
  base := regexp_replace(left(regexp_replace(base, '^[_-]+', ''), 20), '[_-]+$', '');
  if length(base) < 3 then base := 'crate' || base; end if;
  candidate := base;
  while exists (select 1 from public.profiles where handle = candidate and id is distinct from me) loop
    n := n + 1;
    candidate := base || n::text;
  end loop;
  return candidate;
end;
$$;
revoke all on function public.make_handle(text, uuid) from public, anon, authenticated;

-- 새 사용자 → 프로필 (이름·사진 + 아이디)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, avatar_url, handle)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture'),
    public.make_handle(split_part(new.email, '@', 1), new.id)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- 이미 가입한 사람들도 아이디 채우기 (가입 순서대로)
do $$
declare r record;
begin
  for r in
    select p.id, u.email from public.profiles p join auth.users u on u.id = p.id
    where p.handle is null order by p.created_at
  loop
    update public.profiles set handle = public.make_handle(split_part(r.email, '@', 1), r.id) where id = r.id;
  end loop;
end $$;

-- 내 공개 설정 바꾸기: p_public(null = 그대로), p_handle(null = 그대로)
-- 오류: handle_invalid(형식) / handle_taken(다른 사람이 씀)
create or replace function public.set_my_collection_share(p_public boolean default null, p_handle text default null)
returns table (handle text, collection_public boolean)
language plpgsql
security definer set search_path = ''
as $$
#variable_conflict use_column
declare
  me uuid := auth.uid();
  h text;
begin
  if me is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if p_handle is not null then
    h := lower(trim(p_handle));
    if h !~ '^[a-z0-9][a-z0-9_-]{1,22}[a-z0-9]$' then raise exception 'handle_invalid' using errcode = '22023'; end if;
    if exists (select 1 from public.profiles p where p.handle = h and p.id <> me) then
      raise exception 'handle_taken' using errcode = '23505';
    end if;
    update public.profiles p set handle = h where p.id = me;
  end if;
  if p_public is not null then
    update public.profiles p set collection_public = p_public where p.id = me;
  end if;
  return query select p.handle, p.collection_public from public.profiles p where p.id = me;
end;
$$;
revoke all on function public.set_my_collection_share(boolean, text) from public, anon;
grant execute on function public.set_my_collection_share(boolean, text) to authenticated;

-- 공개 컬렉션 보기 (공개한 사람만). { handle, owned: [...], wishlist: [...] } / 없거나 비공개면 null
create or replace function public.public_collection(p_handle text)
returns json
language sql
stable
security definer set search_path = ''
as $$
  select json_build_object(
    'handle', p.handle,
    'owned', coalesce((select json_agg(row_to_json(s) order by s.created_at desc) from (
      select ua.created_at, al.id, al.slug, al.title, al.artist_names, al.thumb_path, al.cover_color,
             coalesce((select json_agg(g.slug) from public.album_genres ag join public.genres g on g.id = ag.genre_id where ag.album_id = al.id), '[]'::json) as genres
      from public.user_albums ua join public.albums al on al.id = ua.album_id
      where ua.user_id = p.id and ua.kind = 'owned' and al.status = 'published') s), '[]'::json),
    'wishlist', coalesce((select json_agg(row_to_json(s) order by s.created_at desc) from (
      select ua.created_at, al.id, al.slug, al.title, al.artist_names, al.thumb_path, al.cover_color,
             coalesce((select json_agg(g.slug) from public.album_genres ag join public.genres g on g.id = ag.genre_id where ag.album_id = al.id), '[]'::json) as genres
      from public.user_albums ua join public.albums al on al.id = ua.album_id
      where ua.user_id = p.id and ua.kind = 'wishlist' and al.status = 'published') s), '[]'::json)
  )
  from public.profiles p
  where p.handle = lower(trim(p_handle)) and p.collection_public;
$$;
grant execute on function public.public_collection(text) to anon, authenticated;

-- 사이트맵용: 공개한 사람들의 아이디
create or replace function public.public_collection_handles()
returns setof text
language sql
stable
security definer set search_path = ''
as $$
  select handle from public.profiles where collection_public and handle is not null order by handle;
$$;
grant execute on function public.public_collection_handles() to anon, authenticated;
