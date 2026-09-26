# Album detail — 커버 + 바이닐 / YouTube 재생

## 직전 버전 대비 적용 파일
변경:
- src/components/album/AlbumDetailView.jsx
- src/app/album/[id]/page.js
- src/app/globals.css (끝의 listening-stage / record / youtube / navbar 스타일 추가)
추가:
- src/components/album/YouTubeAlbumPlayer.jsx
- src/lib/youtube-player.js

## 화면
본문 max-width 1100px, 커버/디스크 무대 max-width 1000px로 와이드 화면에서도 중앙에 모입니다.
왼쪽 커버, 오른쪽 디스크, 아래 앨범 정보 및 YouTube 플레이어입니다.
모바일에서도 커버/디스크 쌍은 유지하고 하단 정보/플레이어는 세로로 쌓입니다.
대표색 배경, 전환 커버의 data-album-cover 목적지 유지, 메뉴 명도 보정.
디스크는 CSS로 만든 원형 레코드이며 GSAP 페이지 전환과 독립적으로 회전합니다.

## 데이터 / Claude 공유
기존 albums 조회에 youtube_playlist_id, rpm 추가.
AlbumDetailView의 album prop에 youtubePlaylistId, rpm 추가. 화면 컴포넌트는 직접 DB 조회하지 않습니다.
DB 변경/추가 패키지 없음. youtube_playlist_id에는 기존 등록 API가 저장하는 list ID가 있어야 합니다.
미등록이면 안내 표시. 기존 상세 props와 합칠 때 필드명을 맞춰주세요.

## 플레이어
앨범 듣기 버튼을 누를 때 YouTube IFrame API를 로드합니다.
공식 동영상 플레이어를 화면에 표시하고 재생/일시정지 및 외부 YouTube 링크를 제공합니다.
실제 onStateChange=1일 때만 회전, 나머지 상태(정지/버퍼링/종료)는 현재 각도에서 멈춥니다.
회전 주기는 rpm 기준이며 모션 축소 설정에서는 회전하지 않습니다.
초기 재생이 브라우저에서 차단되면 공식 플레이어의 재생 버튼을 누르도록 안내합니다.
외부 YouTube 탭의 재생 상태는 동기화되지 않습니다. 페이지 내 플레이어로 재생해야 디스크가 회전합니다.
임베드 제한/삭제/비공개/네트워크 실패 시 재연결 또는 외부 링크 사용.
페이지 이탈 시 플레이어 destroy, 회전 중지, 타이머 정리.

## 검증
모의 YT API 이벤트로 재생/일시정지/버퍼링/종료/차단/오류/언마운트 뒤 이벤트 무시를 검증했습니다.
실제 YouTube 재생, Supabase 연결, Next 빌드 및 브라우저 시각 검증은 미실시입니다.
공식 문서: https://developers.google.com/youtube/iframe_api_reference

## 최신 수정 — 디스크 등장 / 커버 hover / 왼쪽 플레이리스트
직전 버전에서 다음 3개를 반영하세요:
- src/components/album/AlbumDetailView.jsx
- src/app/album/[id]/page.js
- src/app/globals.css

커버 이동 오버레이가 해제된 뒤 디스크가 커버 뒤에서 오른쪽으로 1.15초 동안 이동합니다.
직접 진입 시 인트로 완료 후 등장합니다. 전환 대기는 MutationObserver로 실제 상태를 확인하며 고정 지연을 사용하지 않습니다.
이동은 외부 wrapper, 재생 회전은 내부 디스크에 적용하여 충돌을 방지합니다.
커버의 내부만 포인터에 따라 최대 ±7도 기울어집니다. 원래 위치 측정/커버 이동 목적지는 고정됩니다.
터치와 모션 축소에서는 기울기를 적용하지 않습니다.
왼쪽 아래에 Playlist 수록곡과 YouTube 플레이어, 오른쪽 아래에 앨범 정보를 배치합니다.
tracks 테이블에서 disc_no, side, side_position, title, duration_sec를 album_id로 조회하여 순서대로 표시합니다.
새 props: tracks [{discNo, side, position, title, durationSec}], tracksUnavailable. 곡명 클릭 재생 기능은 포함하지 않습니다.
트랙 미등록과 조회 오류는 별도 안내로 표시하며 앨범 본문은 계속 표시합니다.
모의 테스트: 인트로/커버 이동 완료 전 대기, 다음 프레임 리빌, 옵저버 해제 확인. YouTube 상태 연동 회귀 테스트 통과.
실제 앱/DB/브라우저 시각 검증은 미실시입니다.

## 최신 수정 — 디스크 표시 보정 / 하단 레이아웃 수정
직전 버전 대비 AlbumDetailView.jsx와 globals.css만 교체합니다.
디스크 wrapper에 width:49%, aspect-ratio:1을 명시하고 내부 원판을 absolute inset:0, width/height:100%로 고정합니다.
visibility:hidden을 제거하고 커버 뒤 translateX(-100%) → 오른쪽 translateX(0)으로 이동합니다.
커버 이동이 종료된 뒤 두 프레임을 거쳐 등장하여 초기 위치가 먼저 그려지도록 합니다.
왼쪽: 앨범 정보 → Playlist. 오른쪽: 앨범 듣기 → YouTube. 모바일에서는 순서대로 쌓입니다.
완료 대기·두 프레임 리빌·옵저버 정리 모의 테스트 통과. 실제 브라우저에서 디스크 표시/애니메이션은 미검증입니다.


## 2026-09-26 디자인 및 컬러
- 앨범 대표색 단색 배경 유지. 그라데이션 미적용.
- Bodoni 제목, 좌측 앨범 정보와 LP 면 선택 트랙 목록, 우측 재생 및 커버 미리보기.
- 커버/디스크 8% 겹침. 등장 이동과 재생 회전 분리 유지.
- src/lib/album-theme.js: 크림/잉크 우선, 부족하면 검정/흰색 방향으로 보정. 본문/보조문구 모두 배경 대비 4.5 이상. 장식 선은 제외.
- 그라데이션 도입 시 텍스트 뒤 모든 구간의 대비를 다시 계산해야 함.
- 4,096색 대비 검사 및 플레이어 이벤트 모의 검사 통과. 실제 브라우저 렌더와 YouTube 통합 검증은 별도 필요.
