# 헤더 함께 플립 패치

성능 패치(grooves-crate-flip-perf)를 적용한 프로젝트 기준입니다. 같은 경로에 덮어쓰면 됩니다. 새 파일은 없습니다.
모션 수치와 성능 패치 내용은 그대로입니다.

| 파일 | 변경 내용 |
| --- | --- |
| components/Provider.jsx | 고정 `<Navbar />` 제거. 헤더는 이제 페이지마다 렌더 |
| components/crate/CratePage.jsx | 페이지 상단(스크롤 영역 `.ct-content` 바깥)에 `<Navbar path={entry.path} pageKey={entry.key} />` 렌더 → 헤더가 페이지와 함께 플립되고 본문 스크롤에는 따라가지 않음 |
| components/Navbar.jsx | `path`, `pageKey` prop을 받음 (usePathname을 쓰면 떠나는 페이지 헤더가 새 경로로 바뀌기 때문). 인디케이터 paint를 페이지 key로 등록. 좌표는 offsetLeft/offsetWidth로 측정해 기울어진 페이지 안에서도 정확. `--ct-header-h` 기록 제거 |
| components/crate/CrateProvider.jsx | 단일 `indicator` ref → 페이지별 `indicators` Map |
| components/crate/CrateStage.jsx | 인디케이터를 들어오는 페이지의 헤더에 그림(이전 메뉴 → 새 메뉴). 전환 시작 시 그 헤더만 1회 측정. 착지 후 남는 페이지 헤더에 스냅 |
| app/globals.css | `.ct-navbar`를 페이지 기준 `position:absolute`로. 슬리브는 헤더 높이만큼 내리지 않고 화면 전체(`inset:0`) |

## 확인한 것 (production 빌드, Chromium)
- 빌드 성공, 브라우저 오류 없음
- 평소에는 헤더 1개, 전환 중에는 떠나는 판·들어오는 판에 헤더 2개, 끝나면 다시 1개
- 각 헤더의 활성 메뉴(aria-current)는 자기 페이지 기준으로 유지, 인디케이터는 착지 후 새 메뉴 위치에 정확히 스냅
- 정방향, 브라우저 뒤로가기, 핸들 드래그 취소·확정 정상

## 동작이 달라진 점
- 전환 중에는 헤더도 움직이고 입력이 잠기므로, 전환 도중 메뉴를 눌러 다음 이동을 예약하는 일은 사실상 없어집니다 (예약 로직 자체는 남아 있어 브라우저 뒤로가기 등은 그대로 처리).
