# Grooves — Home New Vinyls 연결

기준: 2026-09-26, 제공된 tsconfig.zip + 공유 DB 문서.

## 적용
기존 프로젝트에 아래 3개 파일만 같은 경로로 복사하세요.
- src/lib/recent-vinyls.js (추가)
- src/components/home/NewVinylsSection.jsx (변경)
- src/components/home/VinylFan.jsx (변경)

나머지 파일은 제공된 원본 그대로입니다. 별도 패키지 추가, DB 변경, service role 키 사용은 없습니다.
현재 로컬에서 다른 작업을 했다면 전체 src 덮어쓰기 대신 위 3개 파일만 반영하세요.

## 동작
- 홈 클라이언트에서 기존 Supabase 브라우저 클라이언트로 albums를 조회합니다.
- status=published, created_at DESC, id DESC, 최대 7개.
- 최근 업로드는 앨범 최초 등록일 기준입니다. 커버 교체/기존 앨범 수정은 최신 순서를 바꾸지 않습니다.
- 홈 진입/새로고침 시 조회합니다. 실시간 구독은 아닙니다.
- DB의 title, artist_names를 표시하고 cover_path(없으면 thumb_path)를 3D 커버로 사용합니다.
- 이미지 로딩 중/실패 시 cover_color 또는 기본 파랑으로 대체합니다.
- 기존 드래그/방향키/모바일 배치를 유지합니다.
- 목록 로딩, 공개 앨범 0개, 오류 및 재시도 UI를 제공합니다.
- 페이지 이탈 시 요청 취소, 개별 이미지 텍스처 정리를 처리합니다.
- Digging의 발매일 정렬과 RPC는 변경하지 않습니다.
- 앨범 클릭의 대표색 전환과 상세 이동은 다음 작업 범위입니다.

## 조회 계약 (Claude 공유용)
테이블: albums
필드: id, slug, title, artist_names, cover_path, thumb_path, cover_color, created_at
필터: status = published
정렬: created_at DESC, id DESC
제한: 7
필수 환경변수(기존): NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
필수 권한: 비로그인 사용자가 published 앨범을 SELECT 가능해야 합니다.
Storage: 기존 public album-covers 버킷. 브라우저 WebGL 이미지 접근이 가능해야 합니다.
추가 RPC와 SQL은 필요하지 않습니다. RLS 실제 적용 상태는 검증하지 않았습니다.

## 검증
모의 Supabase 클라이언트로 조회 필터, 정렬, 개수, AbortSignal 전달, 빈 결과, 오류 전파를 확인했습니다.
원본 ZIP 대비 기존 파일 2개 변경 / 파일 2개 추가(이 문서 포함)를 확인했습니다.
실제 DB/브라우저/Next 빌드 검증은 수행하지 않았습니다. 환경변수, 전체 설정과 설치 의존성이 제공되지 않았습니다.

적용 후 확인:
1. published 앨범이 0개/1개/7개 이상일 때 안내와 실제 개수가 맞는지 확인.
2. 발매일이 오래된 앨범을 새로 등록해도 홈 맨 앞에 표시되는지 확인.
3. pending 앨범이 나오지 않는지 확인.
4. 커버가 정상 표시되고 드래그/좌우 키로 제목·아티스트·카운터가 바뀌는지 확인.
5. 네트워크 실패 시 재시도 버튼, 커버만 실패 시 대표색 대체 확인.

참고 공식 문서:
https://supabase.com/docs/reference/javascript/using-modifiers-order
https://supabase.com/docs/reference/javascript/using-modifiers-abortsignal
https://threejs.org/docs/pages/TextureLoader.html
https://threejs.org/docs/pages/Texture.html

## 최신 변경: 크기 축소, 제목 리빌, 디스크 제거, 앨범 순차 등장
최근 앨범 연결 이후 아래 4개를 반영하세요:
- src/components/home/VinylFan.jsx
- src/components/home/VinylShelf.jsx
- src/components/home/NewVinylsSection.jsx
- src/components/home/NewVinylsSection.module.css
직전 크기 축소/제목 리빌 버전을 이미 적용했다면 VinylFan.jsx와 VinylShelf.jsx만 교체하면 됩니다.
디스크/그루브 삭제. 섹션 25% 진입 시 1회, 앨범별 120ms 지연, 각 1.05초 상승. 모션 축소 시 즉시 표시.
크기는 이전 축소 버전 유지, 제목 리빌 유지. 순차 지연 계산과 원판 메시 제거, ZIP 무결성 확인. 실제 브라우저 렌더링은 미검증.

## 최신 수정 — 대표색 박스 / 화면 비율 대응
직전 버전에서 src/components/home/VinylFan.jsx만 교체합니다.
박스의 옆면과 뒷면에 cover_color 적용, 누락 시 #bbcbda 사용.
회전된 박스의 실제 투영 범위와 전체 앨범 행의 폭/높이를 계산해 카메라 zoom을 제한합니다.
상단/하단 안전 여백을 확보하고 데스크톱 최초 배치에서 전체 행을 맞춥니다.
수평 탐색 중 각 앨범의 최종 높이를 유지하여 세로 잘림을 방지합니다. 좌우 화면 밖 앨범은 드래그로 탐색합니다.
기존 순차 상승·제목 리빌·DB 연결 유지. 2048x1040, 2560x1080, 3440x1440, 1920x720, 1440x900, 390x844에서 1개/7개 앨범의 투영 경계 계산 확인.
실제 앱 브라우저 렌더링은 미검증입니다.

## 最新修正 / 최신 수정 — 대각선 탐색 복원 및 두께 1.5배
직전 버전에서 src/components/home/VinylFan.jsx만 교체하세요.
DEPTH: 0.06 → 0.09. 박스와 앞면 이미지 위치, 투영 경계 계산에 함께 반영됩니다.
y 위치에도 i - scroll.current를 적용하여 다음 앨범으로 이동할 때 행 전체가 왼쪽 아래로 이동합니다.
선택 앨범은 첫 앨범의 하단 기준 위치에 도착합니다. 이전의 수평 전용 이동 설명은 이 변경으로 대체됩니다.
최초 배치의 화면 맞춤은 유지합니다. 탐색 중 이전 앨범은 좌측/하단 화면 밖으로 나갈 수 있습니다.
대표색, 순차 등장, 제목 리빌 유지. 두께 배율 및 선택 앨범 도착 위치 확인. 실제 앱 렌더링은 미검증.


## Hover 및 상세 이동 (2026-09-26)
- Hover된 앨범 제목/아티스트를 하단 표시. 선택 커버 정면 회전, 좌우 앨범은 각 방향으로 부드럽게 펼침.
- 포인터 이탈 시 기존 기울기와 간격으로 복귀. Reduced motion에서는 즉시 변경.
- 3D 커버 모서리를 화면 좌표로 투영하여 기존 AlbumTransitionProvider 연결.
- 6px 초과 드래그 및 취소 후 클릭 이동 방지. 방향키 탐색/Enter 상세 이동.
- VinylFan.jsx, VinylShelf.jsx, NewVinylsSection.jsx 수정. DB 변경 없음.
- 포인터 제스처 로직 모의 검사 통과. 실제 WebGL/브라우저 시각 검증 필요.
