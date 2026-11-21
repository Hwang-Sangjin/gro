-- "Earth, Wind & Fire" 가 쉼표에서 잘려 Earth / Wind & Fire 두 아티스트로 저장된 것을 하나로 합친다.
-- 원인: 관리자 폼이 아티스트를 쉼표로 나눴음 (폼은 한 줄에 한 명으로 고침).
--
-- Supabase SQL Editor 에서 통째로 실행. 트랜잭션이라 중간에 실패하면 아무것도 안 바뀜.
-- 다시 실행해도 안전함.

begin;

-- 1) 합친 아티스트 (슬러그는 slugify("Earth, Wind & Fire") 결과)
insert into public.artists (slug, name) values ('earth-wind-fire', 'Earth, Wind & Fire')
on conflict (slug) do update set name = excluded.name;

-- 2) 잘린 두 아티스트에 걸린 연결을 지우고, 그 앨범을 합친 아티스트에 연결
with cut as (
  delete from public.album_artists aa
  using public.artists ar
  where ar.id = aa.artist_id and ar.slug in ('earth', 'wind-fire')
  returning aa.album_id
)
insert into public.album_artists (album_id, artist_id, position)
select distinct c.album_id, (select id from public.artists where slug = 'earth-wind-fire'), 0
from cut c;

-- 3) 더는 어떤 앨범에도 안 걸린 잘린 아티스트 삭제
delete from public.artists ar
where ar.slug in ('earth', 'wind-fire')
  and not exists (select 1 from public.album_artists aa where aa.artist_id = ar.id);

commit;

-- 4) 결과 확인 (1줄: earth-wind-fire / Earth, Wind & Fire)
select al.slug, al.artist_names, ar.slug as artist_slug, ar.name as artist_name
from public.albums al
join public.album_artists aa on aa.album_id = al.id
join public.artists ar on ar.id = aa.artist_id
where al.slug like 'earth-wind-and-fire-%';
