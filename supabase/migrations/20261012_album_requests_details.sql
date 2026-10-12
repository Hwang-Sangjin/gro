-- 앨범 요청에 선택 정보 추가 (장르·발매·포맷·레이블·카탈로그·YouTube·트랙·커버)
-- Supabase 대시보드 → SQL Editor 에 통째로 붙여넣고 Run. (20261012_album_requests.sql 다음에)
-- 관리자가 "Add album" 을 누르면 이 값들이 앨범 등록 폼에 그대로 채워짐

alter table public.album_requests
  add column if not exists genres           text[],
  add column if not exists release_date     date,
  add column if not exists release_year     integer check (release_year is null or release_year between 1900 and 2100),
  add column if not exists format           text check (format is null or char_length(format) <= 20),
  add column if not exists label            text check (label is null or char_length(label) <= 200),
  add column if not exists catalog_no       text check (catalog_no is null or char_length(catalog_no) <= 100),
  add column if not exists youtube_playlist text check (youtube_playlist is null or char_length(youtube_playlist) <= 300),
  add column if not exists tracks           text check (tracks is null or char_length(tracks) <= 6000),  -- "A | 제목 | 4:32" 한 줄씩
  add column if not exists cover_path       text;                                                         -- request-covers 버킷 안 경로

-- 사용자가 올리는 커버 이미지 보관함 (5MB, 이미지만). 공개 읽기 = 관리자 화면에서 미리보기
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('request-covers', 'request-covers', true, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- 본인 폴더(사용자 id)에만 올릴 수 있음: request-covers/<user id>/파일
drop policy if exists "request covers upload own folder" on storage.objects;
create policy "request covers upload own folder" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'request-covers' and (storage.foldername(name))[1] = (select auth.uid())::text);
