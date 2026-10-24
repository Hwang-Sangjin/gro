-- 바이닐 장소 (Lab · Map)
-- Supabase 대시보드 → SQL Editor 에 통째로 붙여넣고 Run. (여러 번 실행해도 안전)
--
-- places: 지도에 올라가는 장소 1곳 = 1줄
-- - kind: shop(레코드숍) | bar(LP 바·카페) | listening(리스닝룸) | event(페어·팝업 — 기간 있음)
-- - 누구나 공개(published) 장소를 읽을 수 있음. 쓰기는 관리자 화면(서버, 서비스 키)에서만
-- - lat/lng: 관리자 화면에서 지도를 눌러 채움

create table if not exists public.places (
  id          bigint generated always as identity primary key,
  slug        text not null unique,
  name        text not null,                 -- 간판 이름 (한글 그대로)
  name_en     text,                          -- 영문 표기 (있으면)
  kind        text not null check (kind in ('shop', 'bar', 'listening', 'event')),
  area        text,                          -- 동네: 성수, 합정, 망원, 을지로 …
  address     text,                          -- 도로명 주소
  lat         double precision not null check (lat between 33 and 39.5),
  lng         double precision not null check (lng between 124 and 132),
  hours       text,                          -- 영업시간 (자유 형식: "화–일 13:00–21:00 · 월 휴무")
  instagram   text,                          -- 아이디만 (@ 없이)
  website     text,
  map_url     text,                          -- 카카오맵·네이버지도 장소 링크 (선택)
  note        text,                          -- Grooves 톤 한 줄 소개
  genres      text[] not null default '{}',  -- 잘 맞는 장르 slug (lib/genres)
  starts_on   date,                          -- event 만: 시작일
  ends_on     date,                          -- event 만: 종료일
  news_slug   text,                          -- 관련 News 글 (/news/<slug>)
  status      text not null default 'draft' check (status in ('published', 'draft')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint places_event_dates check (ends_on is null or starts_on is null or ends_on >= starts_on)
);

create index if not exists places_status_kind on public.places (status, kind);

-- 고칠 때마다 updated_at 갱신
create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end;
$$;
drop trigger if exists places_touch on public.places;
create trigger places_touch before update on public.places
  for each row execute function public.touch_updated_at();

alter table public.places enable row level security;

drop policy if exists "places read published" on public.places;
create policy "places read published" on public.places
  for select to anon, authenticated using (status = 'published' or public.is_admin());
-- insert / update / delete 정책 없음 = 브라우저에서는 못 씀. 관리자 화면은 서버(서비스 키)로 처리

grant select on public.places to anon, authenticated;
