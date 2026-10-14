-- 앨범 상세의 "Owned by N collectors" — 이 판을 소장(owned)한 사람 수
-- Supabase 대시보드 → SQL Editor 에 통째로 붙여넣고 Run. (여러 번 실행해도 안전)
-- user_albums 는 본인 행만 보이므로(RLS), 숫자만 돌려주는 함수로 셈 (누가 가졌는지는 알려 주지 않음)

create or replace function public.album_owner_count(p_album_id text)
returns integer
language sql
stable
security definer set search_path = ''
as $$
  select count(*)::int from public.user_albums ua
  where ua.album_id::text = p_album_id and ua.kind = 'owned';
$$;
grant execute on function public.album_owner_count(text) to anon, authenticated;
