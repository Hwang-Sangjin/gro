-- 장소 위치를 나중에 찍을 수 있게 (조사한 장소를 "숨김 + 핀 없음" 으로 먼저 넣고, 관리자 화면에서 지도에 핀을 찍은 뒤 공개)
-- SQL Editor 에 붙여넣고 Run. (여러 번 실행해도 안전)
-- 규칙: 지도에 공개(published)하려면 lat/lng 가 꼭 있어야 함

alter table public.places alter column lat drop not null;
alter table public.places alter column lng drop not null;

alter table public.places drop constraint if exists places_published_needs_location;
alter table public.places add constraint places_published_needs_location
  check (status <> 'published' or (lat is not null and lng is not null));
