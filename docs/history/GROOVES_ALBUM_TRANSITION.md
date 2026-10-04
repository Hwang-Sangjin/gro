# Digging → Album Detail 전환 (2026-09-26)

## 직전 버전에서 반영할 파일
변경:
- src/components/Provider.jsx
- src/components/digging/DiggingGrid.jsx
- src/app/globals.css (파일 끝 album-flight/album-detail 관련 규칙)
- src/app/album/[id]/page.js
추가:
- src/components/album/AlbumTransitionProvider.jsx
- src/components/album/AlbumDetailView.jsx
- src/app/album/[id]/error.jsx
- src/app/album/[id]/not-found.jsx

전체 ZIP에 이전 Home 작업도 유지되어 있습니다. Claude가 동일 파일을 수정했다면 전체 덮어쓰기 대신 변경 내용을 병합하세요.

## 동작
일반 클릭/Enter: 클릭한 커버 위치를 복제 → 0.45초 동안 대표색 배경 표시 → 상세 경로 이동 → 상세 커버 실제 좌표로 0.9초 이동 → 0.3초 동안 오버레이가 사라지며 정보 표시.
데스크톱 왼쪽/모바일 위쪽 커버. 화면 크기에 따라 목적지 DOM 좌표를 직접 측정합니다.
애니메이션 동안 기존 브라우저 ViewTransition 스냅샷 표시를 억제합니다. 메뉴 간 기존 전환은 유지합니다.
Ctrl/Cmd/Shift 클릭, 새 탭, 직접 URL 방문은 일반 링크 동작입니다.
모션 축소 설정에서는 커버 이동을 생략합니다.
조회 실패/404에서는 오버레이 제거. 10초 제한, 브라우저 뒤로가기, 리사이즈에도 임시 상태를 정리합니다.
고해상도 커버가 로드되기 전 썸네일을 유지합니다.

## 라우팅 범위
기존 /album/[id]의 id에는 실제로 slug가 들어갑니다. 공개 앨범만 조회합니다.
이번 버전은 독립 상세 페이지로 이동합니다. Intercepting Routes, 목록 스크롤 복구, 역방향 커버 애니메이션은 포함하지 않았습니다.
Home 클릭 연동은 포함하지 않았습니다.

## 데이터 / Claude 공유
조회는 page.js 서버 컴포넌트에서 수행, 화면은 Supabase import 없이 camelCase props와 완성된 URL을 받습니다.
albums select: id, slug, title, artist_names, cover_path, thumb_path, cover_color, release_year, format, label, description
필터: slug, status=published
AlbumDetailView album props: id, slug, title, artistNames, coverUrl, thumbUrl, coverColor, releaseYear, format, label, description
기본 상세 화면에는 커버, 제목, 아티스트, 연도/포맷, 레이블, 설명만 있습니다.
트랙/YouTube/컬렉션/로그인은 이 작업의 범위에 포함하지 않았습니다. 전체 상세 props 명세와 합치는 경우 이 기본 화면을 확장하세요.
DB 변경이나 패키지 추가는 없습니다.

## 확인
모의 DOM/router/GSAP로 배경 이후 이동, 목적지 크기, 모션 축소, 오류 정리, inert/원본 복구 확인.
실제 Supabase, Next.js 빌드, 브라우저 시각 검증은 수행하지 않았습니다.
적용 후 일반 클릭/키보드 Enter/새 탭/뒤로가기, 모바일, 로딩 지연, 없는 slug, 이미지 실패를 확인하세요.

참고:
https://gsap.com/docs/v3/GSAP/Timeline/
https://nextjs.org/docs/app/api-reference/functions/use-router
