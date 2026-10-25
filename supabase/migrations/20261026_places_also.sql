-- 장소 종류를 여러 개로 (바이닐앤플라스틱 = 레코드숍 + 리스닝룸 처럼)
-- SQL Editor 에 붙여넣고 Run. (여러 번 실행해도 안전)
-- kind = 1번(대표) — 지도 마커 색. also = 2번부터 (고른 순서대로). 탭·필터에선 둘 다로 찾아짐

alter table public.places add column if not exists also text[] not null default '{}';

alter table public.places drop constraint if exists places_also_kinds;
alter table public.places add constraint places_also_kinds
  check (also <@ array['shop', 'bar', 'listening', 'event']::text[] and not (kind = any(also)));
