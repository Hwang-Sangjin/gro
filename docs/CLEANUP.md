# 프로젝트 정리 — 2026-10-04

## 결과

- 미사용 파일 29개 제거: 파일 내용 기준 600,451 bytes (약 586 KiB).
- 모든 App Router 페이지·API를 진입점으로 삼아 import/export/dynamic import 연결을 확인했습니다.
- 현재 의존성은 모두 실행 또는 빌드에 필요하여 패키지와 lock 버전은 유지했습니다.
- 기존 루트 문서 8개를 `docs/history/`로 이동했습니다. 이전 README는 `CRATE-FLIP.md`입니다.

## 삭제한 파일

- `src/components/crate/pageContext.js`
- `src/components/digging/VinylCrate.jsx`
- `src/components/digging/VinylStack.jsx`
- `src/components/home/FooterSection.jsx`
- `src/components/home/HomeDecoration.module.css`
- `src/components/home/HomeTagline.css`
- `src/components/home/HomeTagline.jsx`
- `src/components/home/useHomeLenis.js`
- `src/components/viewport/DiscColor.jsx`
- `src/components/viewport/ViewportVars.jsx`
- `src/lib/new-vinyls.js`
- `src/utils/supabase/admin.ts`
- `jsconfig.json`
- `eslint.config.mjs`
- `public/hero.jpg`
- `public/images/grooves/listening-room.webp`
- `public/file.svg`
- `public/globe.svg`
- `public/next.svg`
- `public/vercel.svg`
- `public/window.svg`
- `public/images/grooves/decorations/vinyl-albums.gif`
- `public/images/grooves/decorations/vinyl-player.png`
- `public/images/grooves/decorations/vinyl-player.gif`
- `public/images/grooves/decorations/vinyl-disk.gif`
- `public/images/grooves/decorations/gramophone.png`
- `public/images/grooves/decorations/vinyl-albums.png`
- `public/images/grooves/decorations/vinyl-disk.png`
- `public/images/grooves/decorations/gramophone.gif`

## 삭제 근거

- 연결되지 않은 컴포넌트·훅·목업·관리자 클라이언트는 앱 진입점에서 도달하지 않습니다.
- `ViewportVars`는 이전 전환의 정사각형 변수만 갱신했습니다. 해당 CSS와 함께 제거하고 layout 연결을 해제했습니다.
- 현재 장식은 `/doodles/{id}/{frame}.webp`를 사용합니다. 이전 GIF/PNG 8개는 사용하지 않습니다.
- Hero는 `ListeningRoomScene.jsx`의 3D 씬입니다. 이전 hero.jpg, listening-room.webp는 참조되지 않습니다.
- Next 기본 SVG 5개는 참조되지 않습니다.
- `jsconfig.json`의 alias는 `tsconfig.json`에 동일하게 존재합니다. allowJs가 설정된 tsconfig로 통일했습니다.
- `eslint.config.mjs`는 설치되어 있지 않은 eslint 및 eslint-config-next를 참조하며 lint 스크립트도 없었습니다. 실행되지 않는 설정을 제거했습니다. ESLint를 다시 도입할 때 패키지와 스크립트를 함께 구성해야 합니다.

## 코드·설정 수정

- `globals.css`: 이전 `.disc`, View Transition page-in/page-out/disc-out, 이전 album-flight 오버레이와 전용 변수를 제거했습니다. Crate Flip과 intro, 앨범 디스크 회전 및 반응형 규칙은 유지했습니다.
- `useReveal.js`: 제거된 네이티브 전환과 albumTransition의 대기 검사만 제거했습니다. 인트로, Crate Flip, 최소 120ms 대기, 랜덤 reveal 지연은 유지했습니다.
- `CategorySection.jsx`: 미사용 toSlug 함수 제거.
- `HomeDecoration.jsx`: GIF라는 오래된 주석을 WebP sprites로 수정.
- package.json 및 tsconfig.json을 읽기 쉬운 JSON으로 정렬. `npm run typecheck` 추가.
- `.gitignore`, 값이 비어 있는 `.env.example` 및 현재 구조를 설명하는 README 추가.

## 유지한 항목

- `/info`, `/projects`는 메뉴 노출 여부와 관계없이 직접 접속 가능한 기존 페이지이므로 유지했습니다. 해당 페이지의 portrait.jpg 및 img1~4.jpg도 유지했습니다.
- 관리자 앨범 등록/커버 처리 API, health API와 관련 라이브러리 유지.
- 24개의 동적 WebP 프레임, 폰트 라이선스, 모든 현재 페이지·인트로·Crate Flip 구현 유지.
- HeroScene 재수출 파일 및 template.jsx는 기존 컴포넌트 경계와 라우트 수명을 유지하기 위해 보존했습니다.

## 검증

- npm ci 성공.
- TypeScript 검사 성공 (noUnusedLocals/noUnusedParameters 포함; checkJs는 기존처럼 활성화하지 않았으므로 JS의 모든 미사용 지역 변수를 검사한 것은 아닙니다).
- 프로덕션 `npm run build` 성공: 16개 정적 페이지 생성 완료, 기존 페이지·API 경로 유지.
- TypeScript AST로 로컬 import/export/문자열 dynamic import를 추적: 누락 import 0개, 앱에서 도달하지 않는 잔여 소스 파일 0개.
- Supabase 형식 검증을 통과하는 임시 빌드용 값만 사용했으며 실제 키를 결과물에 넣지 않았습니다.
- 실제 Supabase 데이터·인증·관리자 쓰기와 브라우저 시각/애니메이션 검증은 수행하지 않았습니다. 빌드 성공이 이 동작의 검증을 의미하지 않습니다.

## 원본에서 확인한 미완성 항목

이번 정리에서 새로 생긴 문제가 아닙니다.

- `public/images/covers/`가 없어서 Category의 커버는 기존 오류 처리에 따라 레코드 대체 그래픽을 표시합니다.
- 뉴스 reissues.jpg/care.jpg/news.jpg가 없어서 기존 placeholder.svg를 사용합니다.
- `/news/reissues`, `/news/care`, `/news/latest` 링크에 대응하는 상세 라우트가 없습니다.
- layout의 title/description에는 기존 Codegrid 문구가 남아 있습니다. 콘텐츠 수정 범위가 아니므로 유지했습니다.

## 적용

기존 프로젝트를 백업한 뒤 정리본을 새 폴더에 풀고 기존 `.env.local`만 복사하세요. 기존 폴더에 덮어쓰기만 하면 이번에 제거한 파일이 남습니다. `npm ci` 후 실행하세요.
