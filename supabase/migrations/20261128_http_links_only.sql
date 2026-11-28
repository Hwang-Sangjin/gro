-- 링크 칸은 http(s) 주소만 (javascript: · data: 같은 주소를 DB 에서 막음)
-- Supabase 대시보드 → SQL Editor 에 통째로 붙여넣고 Run. (여러 번 실행해도 안전)
--
-- 앱에서도 먼저 거르지만(src/lib/safeUrl.js), 요청은 브라우저가 공개 키로 직접 넣으므로
-- 앱을 거치지 않고 보낸 값까지 막으려면 DB 규칙이 있어야 함
-- 2026-11-28 확인: 지금 들어 있는 값 중 규칙에 어긋나는 줄 없음

-- 앨범 요청: link 는 주소만, youtube_playlist 는 주소 또는 재생목록 ID(글자·숫자·_·-)
alter table public.album_requests drop constraint if exists album_requests_link_http;
alter table public.album_requests add constraint album_requests_link_http
  check (link is null or link ~* '^https?://');

alter table public.album_requests drop constraint if exists album_requests_youtube_http_or_id;
alter table public.album_requests add constraint album_requests_youtube_http_or_id
  check (youtube_playlist is null or youtube_playlist ~* '^https?://' or youtube_playlist ~ '^[A-Za-z0-9_-]+$');

-- 장소: 웹사이트 · 지도 링크 (관리자만 쓰지만 같은 규칙)
alter table public.places drop constraint if exists places_links_http;
alter table public.places add constraint places_links_http
  check ((website is null or website ~* '^https?://') and (map_url is null or map_url ~* '^https?://'));
