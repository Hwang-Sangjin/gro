-- 한글 아티스트가 빈 슬러그('') 한 줄로 합쳐진 것을 나눈다.
-- 원인: slugify 가 한글 이름을 '' 로 만들어 upsert(onConflict: slug) 가 같은 줄을 덮어썼음.
-- (코드는 src/lib/slug.js 로 고침. 이 파일은 이미 저장된 데이터를 바로잡는 1회용.)
--
-- Supabase SQL Editor 에서 통째로 실행. 트랜잭션이라 중간에 실패하면 아무것도 안 바뀜.
-- 다시 실행해도 안전함.

begin;

-- 1) 새 아티스트 3명 (슬러그는 고친 slugify 결과와 같게)
insert into public.artists (slug, name) values
  ('검정치마', '검정치마'),
  ('잔나비', '잔나비'),
  ('damons-year', 'Damons Year')
on conflict (slug) do update set name = excluded.name;

-- 2) 빈 슬러그 줄은 김현창 것으로 남기고 슬러그를 채운다
update public.artists set slug = '김현창', name = '김현창' where slug = '';

-- 3) 앨범 7장을 맞는 아티스트로 다시 연결
update public.album_artists aa
set artist_id = (select id from public.artists where slug = m.artist_slug)
from (values
  ('the-black-skirts-team-baby',  '검정치마'),
  ('the-black-skirts-201',        '검정치마'),
  ('the-black-skirts-thirsty',    '검정치마'),
  ('jannabi-legend',              '잔나비'),
  ('jannabi-small-pieces-1',      '잔나비'),
  ('jannabi-the-land-of-fantasy', '잔나비'),
  ('damons-year-headache',        'damons-year')
) as m(album_slug, artist_slug)
join public.albums al on al.slug = m.album_slug
where aa.album_id = al.id
  and aa.artist_id = (select id from public.artists where slug = '김현창');

-- 4) TEAM BABY 발매일 오타 (1017 → 2017)
update public.albums
set release_date = '2017-05-30', release_year = 2017
where slug = 'the-black-skirts-team-baby';

-- 5) 표시용 artist_names 다시 계산.
--    트리거나 생성 컬럼으로 자동 관리되는 경우엔 직접 못 바꾸므로 알림만 남기고 넘어간다.
do $$
begin
  update public.albums a
  set artist_names = (
    select string_agg(ar.name, ', ' order by aa.position)
    from public.album_artists aa
    join public.artists ar on ar.id = aa.artist_id
    where aa.album_id = a.id
  )
  where a.slug in (
    'the-black-skirts-team-baby', 'the-black-skirts-201', 'the-black-skirts-thirsty',
    'jannabi-legend', 'jannabi-small-pieces-1', 'jannabi-the-land-of-fantasy',
    'damons-year-headache',
    'kim-hyunchang-i-live-and-mourn', 'kim-hyunchang-long-to-be-the-garden'
  );
exception when others then
  raise notice 'artist_names 는 자동으로 관리됨 (직접 수정 생략): %', sqlerrm;
end $$;

commit;

-- 6) 결과 확인 (9줄: 검정치마 3, 잔나비 3, Damons Year 1, 김현창 2)
select al.slug, al.artist_names, al.release_year, ar.slug as artist_slug, ar.name as artist_name
from public.albums al
join public.album_artists aa on aa.album_id = al.id
join public.artists ar on ar.id = aa.artist_id
where al.slug like 'the-black-skirts-%'
   or al.slug like 'jannabi-%'
   or al.slug like 'damons-year-%'
   or al.slug like 'kim-hyunchang-%'
order by ar.slug, al.slug;
