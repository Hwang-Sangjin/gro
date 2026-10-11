-- Digging 무작위 순서
-- Supabase 대시보드 → SQL Editor 에 통째로 붙여넣고 Run.
--
-- 들어올 때마다 새 seed(아무 문자열)로 섞인 순서를 받음.
-- 같은 seed 로는 늘 같은 순서라서, 스크롤로 다음 페이지(offset)를 불러와도 겹치거나 빠지는 판이 없음.
-- 이 함수가 없으면 앱은 예전 순서(digging_page)로 자동으로 돌아감.

create or replace function public.digging_shuffle(
  p_seed text,
  p_offset integer default 0,
  p_genre_id text default null,   -- genres.id (타입 상관없이 문자열로 비교)
  p_limit integer default 25
)
returns setof public.albums
language sql
stable
as $$
  select a.*
  from public.albums a
  where a.status = 'published'
    and (p_genre_id is null or exists (
      select 1 from public.album_genres ag
      where ag.album_id = a.id and ag.genre_id::text = p_genre_id
    ))
  order by md5(a.id::text || p_seed), a.id
  offset greatest(p_offset, 0)
  limit least(greatest(p_limit, 1), 100);
$$;

grant execute on function public.digging_shuffle(text, integer, text, integer) to anon, authenticated;
