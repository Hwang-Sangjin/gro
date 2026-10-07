# Home — 4섹션 스테이지 (Claude 프로토타입 이식)

Claude와 만든 단일 파일 프로토타입(grooves-ink-vinyl.html)의 Home을 그대로 옮겼습니다. 이 문서가 HOME-HERO-UPDATE.md, HERO-STEP-*.md, HERO-CLAUDE-INK.md, HERO-INTERACTIONS.md보다 우선합니다.

## 구조

Home은 한 화면(100svh)에서 섹션을 바꿉니다. 문서 스크롤은 쓰지 않습니다.

| 섹션 | 내용 |
| --- | --- |
| 0 Hero | 잉크 바이닐(10 RPM). 누르면 최대 45 RPM까지 가속, 누른 채 끌면 A/B면 뒤집기, 링 타이포·스트로보, 붓 획 헤일로, 먼지, 타이틀 기울기 |
| 1 New Vinyls | 판이 한 바퀴 돌며 착륙 → Supabase 최신 앨범이 판 위 360° 링으로 섬. 끌기·관성·스냅, 클릭하면 들어 올려 확대, 한 번 더 누르면 앨범 상세(기존 커버 이동 전환) |
| 2 Genre dial | 판이 왼쪽으로 가 정면을 봄. 끌기·장르 글자 클릭·←/→로 장르 변경(무한 회전). 장르가 바뀌면 판을 반 바퀴 뒤집으며 장르 색으로, 장르별 성격의 잉크 붓 파동과 박동 |
| 3 News | 다시 크림. 판은 오른쪽 칸에서 턴테이블처럼 돎. 기사 3개, Start digging, 푸터. 화면보다 길면 이 안에서 스크롤 |

- 섹션 이동: 휠·터치 스와이프·PageUp/PageDown/Space/↑↓ (한 칸씩, 전환 중 입력 무시)
- 페이지 사이 이동은 기존 그대로: 상단 메뉴, 아래 가운데 `Flip the crate` 핸들, 링크 클릭(Crate Flip). Home 위에서 마우스로 끌어 페이지를 넘기는 동작만 꺼 두었습니다(아래 CrateStage 변경).
- 테마: 엔진이 `.ct-page`의 `--wire-t`(0 크림 ↔ 1 잉크)를 섹션에 맞춰 바꿉니다. 내비게이션·종이 질감 색이 기존 방식 그대로 따라옵니다. Home 내부 색은 `--hs-*` 변수(`--hs-paper`, `--hs-text`, `--hs-muted`, `--hs-line`, `--hs-ink3d`, `--hs-label3d`, `--hs-genre`)를 씁니다.
- 앨범 상세에서 돌아오면 New Vinyls(또는 떠날 때의 섹션)로, 열었던 앨범이 정면에 온 상태로 돌아옵니다. 메뉴로 Home에 오면 Hero부터.

## 파일

| 경로 | 역할 |
| --- | --- |
| `src/app/page.js` | `.page.home.paper-textured` 안에 `HomeStage`만 렌더 (ssr: false) |
| `src/components/home/stage/HomeStage.jsx` | 마크업(Tailwind), Supabase 데이터, 앨범 커버 이동 전환 연결, 인트로 연결 |
| `src/components/home/stage/homeEngine.js` | Three.js 장면·섹션 전환·입력·DOM 연출. 프로토타입 코드를 거의 그대로 옮김 |
| `src/components/home/stage/homeGenres.js` | 장르별 판 색·설명·파동 성격 (slug 기준, 목록·순서는 `lib/genres.js`) |
| `src/components/home/stage/newsArt.js` | 뉴스 카드 SVG 일러스트 |
| `src/components/crate/CrateStage.jsx` | `[data-crate-ignore]` 영역에서는 마우스 드래그로 페이지를 넘기지 않음 (핸들은 그대로) |

엔진은 R3F 대신 Three.js를 직접 씁니다. 프로토타입의 렌더 루프·입력·DOM 연출이 한 프레임 안에서 얽혀 있어서, 컴포넌트로 다시 쪼개면 조정해 둔 값과 타이밍이 달라질 위험이 큽니다. 앞으로 다른 페이지의 3D는 기존처럼 R3F를 써도 됩니다.

## 데이터

- New Vinyls: `fetchRecentVinyls` (최신 7장). 커버는 `coverUrl(cover_path || thumb_path)`을 텍스처로 불러오고, 불러오는 동안·실패 시 절차적 임시 커버를 씁니다. 뒷면은 아티스트·제목이 들어간 트랙리스트 그림입니다.
- Genre dial 커버 3장: `genres`에서 slug → id, `digging_page` RPC(p_limit 3). 장르마다 한 번만 조회하고, 없으면 장르 색 슬리브를 보여 줍니다.
- 뉴스: `HomeStage.jsx`의 `POSTS` (기존 링크 유지). 일러스트는 `newsArt.js`.
- 장르 설명(`desc`)은 임시 카피입니다.

## 조정

| 무엇 | 어디 |
| --- | --- |
| 회전 속도, 누르기 가속 | `homeEngine.js` `SPIN`, `HOLD` |
| 섹션 전환 시간·휠 감도 | `SECTION` |
| Hero → New Vinyls 착륙 | `SCROLL`, `LANDED_COMPOSITION` |
| 앨범 링 | `ALBUM`, `RING`, `FOCUS`, `AUTO` |
| 다이얼 | `DIAL`, `layoutDial()` |
| 판 뒤집기 | `GFLIP` |
| 파동 기본값·박동 | `WAVE`, `BEAT` |
| 장르별 색·파동 성격 | `homeGenres.js` |
| News 판 자리 | `NEWS_COMPOSITION` |

## 바뀐 점 (프로토타입 대비)

- 서체: Playfair Display → `Grooves Bodoni`, Inter → 사이트 본문 서체(PP Neue Montreal), 한글은 시스템 서체.
- 프로토타입의 조정 패널, 자체 헤더·Flip the crate 버튼, ↺ Play it again 버튼은 뺐습니다. 사이트 공용 내비게이션과 핸들을 씁니다. News 푸터 가운데는 핸들 자리로 비워 두었습니다.
- 상단 여백은 사이트 헤더 높이(`--ct-header-h`) 기준으로 맞췄고, 세로 화면의 다이얼은 핸들과 겹치지 않게 조금 올렸습니다.
- 인트로(프리로더)가 덮고 있는 동안은 3D를 그리지 않고, 끝나면 회전이 출발합니다.

## 이제 Home에서 쓰지 않는 파일

`HeroSection`, `HeroVinylCanvas`, `HeroVinylScene`, `HeroCameraParallax`, `HeroCursor`, `HeroInput`, `heroInteraction`, `NewVinylsSection`, `VinylShelf`, `VinylFan`, `CategorySection`, `NewsSection`, `HomeDecoration`, `useWireProgress`, `FullscreenRoom`, `ListeningRoomScene`, `PaperFadePass` 등 기존 `src/components/home/*`. 확인 후 정리해도 됩니다. `components/vinyl/*`(InkVinyl, SpinHalo, useDiscInput 등)는 그대로 둡니다. Hero 인터랙션 4종(패럴랙스·홀드 가속·HOLD/RPM 커서·속도 반응 이펙트)은 스테이지 엔진에 이미 들어 있습니다.

## 검증

- `npm run typecheck`, `npm run build` 통과.
- Chromium(WebGL, SwiftShader)에서 1440×900, 1100×720, 390×844 확인. Supabase는 같은 응답 형태의 로컬 목 서버로 대체.
  - 4개 섹션 전환, 테마(`--wire-t`) 변화
  - 앨범 클릭 → 확대 → 한 번 더 클릭 → 커버 이동 전환으로 `/album/[slug]` → 뒤로 가기 시 New Vinyls·같은 앨범 정면
  - `Dig into …` → `/digging?genre=…` Crate Flip, 메뉴로 Home 복귀 시 엔진 재생성
- 실제 Supabase 데이터, 외부 폰트, 실제 기기 GPU 성능은 이번 검증에 포함되지 않았습니다.
