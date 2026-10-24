-- 조사한 바이닐 장소 (2026-10-24) — 숨김 + 핀 없음으로 한 번에 넣기
-- 먼저: migrations/20261024_places.sql, migrations/20261025_places_optional_location.sql
-- 그다음 SQL Editor 에 붙여넣고 Run. 같은 slug 가 이미 있으면 건너뜀 (여러 번 실행해도 안전)
-- 넣은 뒤: /admin/places → 각 장소 Edit → 지도에 핀 → "Show on the map" 켜고 저장
-- 각 줄 위 주석 = 출처와 날짜. "영업 확인 필요" 는 오래된 기사라 인스타·지도 앱으로 한 번 더 확인하고 공개하세요.

insert into public.places (slug, name, name_en, kind, area, address, hours, instagram, note, genres, starts_on, ends_on, news_slug, status) values
  -- 문화뉴스 2025-10-24 (홍대입구역 3번 출구 근처) · 하퍼스바자 2022-06 (@gimbabrecords)
  ('gimbab-records', '김밥레코즈', 'Gimbab Records', 'shop', '홍대', null, null, 'gimbabrecords', '2013년부터 홍대 인디의 산실. 신보·희귀반에 가게가 고른 ''Essential''까지, 사기 전에 직접 들어볼 수 있어요.', array['indie','soul','hip-hop','jazz']::text[], null, null, null, 'draft'),
  -- 문화뉴스 2025-10-24 (영업 확인) · GQ 2020-07 (주소·시간·인스타)
  ('sounds-good-store', '사운즈굿스토어', 'Sounds Good Store', 'shop', '연남', '서울 마포구 성미산로29길 26', '13:00–21:00', 'soundsgood_store', '재즈가 단단한 연남동 가게. DJ들이 찾는 12인치 싱글과 재즈 굿즈도 있어요.', array['jazz','soul']::text[], null, null, null, 'draft'),
  -- 문화뉴스 2025-10-24 · 헤럴드경제 2023-11
  ('metavox', '메타복스', 'Metavox', 'shop', '홍대', null, null, null, '1997년부터, 20만 장이 넘는 중고·수입반. 재즈·메탈·블루스 디깅은 여기서.', array['jazz','rock']::text[], null, null, null, 'draft'),
  -- Mixmag Asia 2025-02-27 (2025-02-22 오픈)
  ('manhattan-records-seoul', '맨해튼레코드 서울', 'Manhattan Records Seoul', 'shop', '홍대', null, null, 'manhattan_records_seoul', '도쿄 시부야의 그 맨해튼레코드가 홍대에. 힙합·블랙 뮤직과 DJ 장비.', array['hip-hop','soul']::text[], null, null, null, 'draft'),
  -- 이투데이 2020-09 (주소·시간) · 헤럴드경제 2023-11 · polomaps 2026 목록
  ('dope-records', '도프레코드', 'Dope Records', 'shop', '대흥', '서울 마포구 독막로 211 4층', '13:00–21:00 · 화 휴무', null, '하드록·메탈이라면 여기. 밴드 굿즈와 옷까지 함께 팔아요.', array['rock']::text[], null, null, null, 'draft'),
  -- Trazy 2024-08 (주소·시간) · 하퍼스바자 2022-06 (인스타) · polomaps 2026 목록
  ('clique-records', '클리크 레코드', 'Clique Records', 'shop', '을지로', '서울 중구 을지로12길 8', '화–금 12:00–20:00 · 주말 13:00–20:00 · 월 휴무', 'clique_records', '레어 그루브 소울, 이탈로 디스코, 전자음악 12인치. 판을 사면 매장 장비로 들어볼 수 있어요.', array['soul','etc']::text[], null, null, null, 'draft'),
  -- Trazy 2024-08 (주소·시간) · polomaps 2026 목록
  ('vinyl-and-plastic', '현대카드 바이닐앤플라스틱', 'Vinyl & Plastic', 'shop', '이태원', '서울 용산구 이태원로 248', '화–토 12:00–21:00 · 일 12:00–18:00 · 월 휴무', null, '신보부터 희귀반까지, 좋은 시스템으로 들어보고 고르는 이태원의 큰 매장.', '{}', null, null, null, 'draft'),
  -- GQ 2022-06 (주소·시간·인스타) · 하퍼스바자 2022-06
  ('welcome-records', '웰컴레코즈', 'Welcome Records', 'shop', '해방촌', '서울 용산구 신흥로 63', '13:00–21:00 · 월·화 휴무 (행사에 따라 다름)', 'welcomerecords_seoul', '360 Sounds의 DJ들이 운영. 낮엔 레코드숍, 밤엔 게스트 DJ 파티.', array['hip-hop','soul','jazz']::text[], null, null, null, 'draft'),
  -- GQ 2020-07 — 오래된 정보, 영업 확인 필요
  ('seoul-vinyl', '서울바이닐', 'Seoul Vinyl', 'shop', '해방촌', '서울 용산구 신흥로 30', '월–토 · 2층 숍 15:00–22:00 · 1층 바 19:00–02:00', 'seoulvinyl', '2층은 레코드숍, 1층은 바이닐 바. 블랙 뮤직·R&B·재즈·시티팝.', array['soul','jazz','city-pop']::text[], null, null, null, 'draft'),
  -- GQ 2020-07 — 오래된 정보, 영업 확인 필요
  ('mosaic-seoul', '모자이크 서울', 'Mosaic Seoul', 'shop', '신당', '서울 중구 다산로31길 64', '화–일 13:00–20:00', 'mosaicseoul', '테크노·브레인댄스와 80–90년대 한국 전자음악 재발매. 핸드드립 커피도 좋아요.', array['etc']::text[], null, null, null, 'draft'),
  -- 이투데이 2020-09 — 오래된 정보, 영업 확인 필요
  ('popsipetel', '팝시페텔', 'Popsipetel', 'shop', '망원', '서울 마포구 월드컵북로4길 44-7 한솔빌딩 102호', '12:00–21:00', null, 'CD·LP에 블루레이와 음악 책까지. 문 닫은 뒤엔 음악 강의가 열려요.', '{}', null, null, null, 'draft'),
  -- Platform Magazine · Time Out (리빙인크 등) — 가게별 위치는 현장 확인
  ('hoehyeon-underground', '회현지하쇼핑센터 레코드숍', 'Hoehyeon Underground Records', 'shop', '회현', '서울 중구 회현지하쇼핑센터 (회현역)', null, null, '60년대부터 이어진 중고 LP 골목. 수만 장 사이에서 오래 디깅하기 좋은 곳.', '{}', null, null, null, 'draft'),
  -- Platform Magazine (동묘시장 · 돌레코드 · Oldies But Goodies)
  ('dongmyo-lp', '동묘 벼룩시장 LP', 'Dongmyo Flea Market LPs', 'shop', '동묘', null, null, null, '50–90년대 중고 LP를 싸게. 돌레코드, 올디스 벗 구디스 같은 가게가 시장 안에 있어요.', '{}', null, null, null, 'draft'),
  -- Trazy 2024-08 (시간·인스타) · 얼루어 2023-09 · polomaps 2026 목록
  ('vinyl-seongsu', '바이닐 성수', 'Vinyl Seongsu', 'bar', '성수', '서울 성동구 아차산로 15-8 2층', '평일 11:00–23:00 · 주말 10:00–23:00', 'vinyl_seongsu', '자리마다 턴테이블과 헤드폰. 통창 옆에서 판을 골라 듣는 LP 카페.', '{}', null, null, null, 'draft'),
  -- 에스콰이어 2025-08
  ('vinyl-hangang', '바이닐 한강점', 'Vinyl Hangang', 'bar', '뚝섬', '서울 광진구 강변북로 2216 3층', '매일 ~24:00', null, '5,000장 넘는 판과 자리마다 턴테이블. 한강 뷰 자리는 예약하는 게 좋아요.', '{}', null, null, null, 'draft'),
  -- 에스콰이어 2025-08 · Trazy 2024-08 (시간·인스타) · 얼루어 2023-09
  ('music-complex-seoul', '뮤직컴플렉스서울', 'Music Complex Seoul', 'bar', '인사동', '서울 종로구 인사동길 49 안녕인사동 5층', '평일 12:00–24:00 · 주말 10:00–24:00', 'music.complex.seoul', '2만 장이 넘는 판, 알텍 A4 스피커. 창가 자리엔 턴테이블이 놓여 있어요.', '{}', null, null, null, 'draft'),
  -- 얼루어 2023-09 — 영업 확인 필요
  ('turndown-service', '턴다운서비스', 'Turndown Service', 'bar', '연남', '서울 마포구 동교로50길 7 반지층', null, null, '커피가 맛있는 반지하 LP 카페. 땅콩 아이스크림이 시그니처, 강아지와 함께 가도 돼요.', '{}', null, null, null, 'draft'),
  -- 에스콰이어 2025-08
  ('groove-dot-vinyl', '그루브닷바이닐', 'Groove.Vinyl', 'bar', '충정로', '서울 서대문구 충정로 73 2층', null, null, '신청곡은 가진 LP로, 없으면 무손실 음원으로. 위스키 한 잔과 함께.', '{}', null, null, null, 'draft'),
  -- 헤이팝 2025-06
  ('hippie-hippie', '히피히피 LP바', 'Hippie Hippie', 'bar', '황학동', '서울 중구 마장로9길 35-1 3층', null, null, '스트리밍 없이 LP와 CD로만 트는 신청곡 바. 사장님 선곡이 사이사이 끼어들어요.', '{}', null, null, null, 'draft'),
  -- 에스콰이어 2026-10-15
  ('232-bar', '232 BAR', '232 BAR', 'bar', '이태원', '서울 용산구 이태원로 232', null, null, '뮤지션 리스닝 세션과 DJ 공연이 열리는 음악 바. 음료만 시키면 따로 표 없이 들어가요.', '{}', null, null, null, 'draft'),
  -- 에스콰이어 2026-10-15 (앤티크가구거리 근처 주택가 건물 5층)
  ('reserve-bar', '리저브 BAR', 'Reserve Bar', 'bar', '이태원', null, null, null, '10평 남짓, 수집가가 고르는 소울·펑크·재즈·하우스. JBL L300 너머로 남산 야경.', array['soul','jazz']::text[], null, null, null, 'draft'),
  -- 에스콰이어 2026-10-15 (남영역·숙대입구역 근처, 철길 쪽 건물 3층)
  ('digging-is-digging', '디거이즈디깅 BAR', 'Digging Is Digging', 'bar', '남영', null, null, null, '철길 앞 3층, 창밖으로 기차가 지나가는 레코드 바. 재즈 중심, 신청곡은 받지 않아요.', array['jazz','soul']::text[], null, null, null, 'draft'),
  -- GQ 2022-06 — 영업 확인 필요
  ('vibed-boulevard', '바이브드블러바드', 'Vibed Boulevard', 'bar', '삼각지', '서울 용산구 한강대로 164 2층', '화·수·일 20:30–01:30 · 목–토 21:00–02:00 · 월 휴무', 'vibdblvd', '올드 펑크·R&B·소울만 도는 빈티지 LP 바. 4명 이상은 받지 않아요.', array['soul']::text[], null, null, null, 'draft'),
  -- 헤이팝 2025-06
  ('sound-cafe-sori', '사운드카페 소리', 'Sound Cafe Sori', 'listening', '홍대', '서울 마포구 와우산로 159 2층', null, null, '30년 모은 LP와 방송국 턴테이블, 50년대 진공관 앰프. 신청곡은 연필로 써서 DJ 부스로.', '{}', null, null, null, 'draft'),
  -- 헤이팝 2025-06 (수요일 테마 행사는 인스타 공지)
  ('quarter', '쿼터', 'Quarter', 'listening', '망원', '서울 마포구 포은로 43-1', null, null, '곡 이름 대신 기분이나 한 문장으로 신청하는 곳. 사장님이 음악 이야기를 곁들여 줘요.', '{}', null, null, null, 'draft'),
  -- 월간 디자인 2026-10-19
  ('seongsu-yul-music', '성수율뮤직', 'Seongsu Yulmusic', 'listening', '성수', null, null, null, '11.4.4채널 돌비 애트모스. 목소리와 악기가 공간 안 제자리에 놓이는 감상 공간.', '{}', null, null, null, 'draft'),
  -- Grooves News (공식 공지 기반)
  ('seoul-record-fair-2026', '서울레코드페어 2026', 'Seoul Record Fair 2026', 'event', '성수', '서울 성동구 왕십리로4길 5 (PUBG 성수)', '10:00–18:00', 'seoul_recordfair', '15회째 레코드 페어. 페어 한정반은 1인 1매, 오전 입장은 사전예약.', '{}', '2026-10-31', '2026-11-01', 'seoul-record-fair-2026', 'draft')
on conflict (slug) do nothing;
