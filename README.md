# Grooves — Crate Flip

첨부된 `public.zip`의 실제 프로젝트에 Claude의 크레이트 플립 전환을 통합한 전체 소스입니다. 원본의 `src/`, `public/` 파일은 모두 포함되어 있습니다.

## 실행

```bash
npm ci
cp .env.example .env.local
# .env.local에 기존 프로젝트의 Supabase 값을 입력
npm run dev
```

프로덕션:

```bash
npm run build
npm start
```

원본 ZIP에는 package.json, lockfile, Next.js/TypeScript/PostCSS 설정이 없어서 실행 가능한 설정을 추가했습니다. 이 배포본은 **Next.js 16.3.8, React 19.2.4, Tailwind 4** 조합으로 검증했습니다. 기존 저장소에 적용할 때는 기존 환경변수를 유지하고 의존성을 비교하세요. `.env.example`에는 값이나 비밀키가 없습니다.

## 적용 범위

- 최초 로딩 및 intro → 첫 페이지: 기존 연출 유지. `src/components/intro/`의 세 파일은 원본과 바이트 단위로 동일합니다.
- intro 완료 후 모든 App Router 경로 변경: 공통 CrateStage에서 처리합니다.
- Home / Digging / Collection / News, Login / Signup, 앨범 상세 및 기존 부가 경로를 포함합니다. 명세의 앨범 상세 제외 규칙보다 사용자의 “intro 외 모든 전환” 요청을 우선했습니다.
- 같은 경로의 검색 조건/쿼리 변경과 페이지 내 앵커는 페이지 플립을 실행하지 않습니다.
- 외부 링크, 새 창, 다운로드, Ctrl/Cmd 클릭은 브라우저 기본 동작입니다.

## 동작

앞의 판이 기울어 떨어지고 뒤의 판이 일어섭니다. 명세의 perspective 2400px, origin 50% -25%, 1300ms, 역방향 t=1→0, shade/cast/spec, 슬리브 3장을 적용했습니다. 하나의 `renderCrate(t)`가 자동 전환과 수동 드래그를 계산합니다.

헤더는 고정되고 활성 메뉴 인디케이터만 이동합니다. 같은 doodle은 GIF에서 추출한 6개의 WebP 프레임과 공유 타이머로 동기화됩니다. 효과음은 페이지를 처음 열 때 꺼져 있고 Sound 버튼으로 켤 수 있습니다.

- 전환 중 여러 메뉴 클릭: 마지막 목적지를 예약하여 현재 전환 후 이동.
- 아래쪽 **Flip the crate** 핸들: 아래로 끌면 다음, 위로 끌면 이전 메뉴.
- 10px부터 드래그를 시작하고 진행률 30% 또는 속도 0.55px/ms 기준으로 확정. 미달하면 복귀.
- 페이지 스크롤을 보존하기 위해 모바일 드래그는 핸들에서만 시작합니다. 마우스는 스크롤 경계의 비인터랙티브 배경에서도 가능합니다.
- 헤더 또는 핸들에 포커스한 상태에서 방향키/PageUp/PageDown 이동. 본문에서 키를 누르면 기본 스크롤을 유지합니다.
- 전환 중 페이지 입력을 잠그고 완료 후 제목에 포커스를 옮깁니다. 모션 감소 설정에서는 짧은 페이드와 정지 doodle을 사용합니다.

수동 드래그는 실제 라우트를 먼저 요청하고 취소 시 `router.replace()`로 원래 주소를 복원합니다. 이 방식은 명세와 동일하며, 취소 직후 브라우저 히스토리에 동일한 출발 주소가 연속으로 남을 수 있습니다.

## 구현 파일

- `src/components/crate/CrateStage.jsx`: 라우팅, 두 페이지 수명 관리, RAF, 큐, 드래그, 접근성.
- `src/components/crate/render.js`: 명세의 전환 수식. 속도는 CrateStage의 `1300`, 최소 시간은 `260`에서 조절.
- `src/components/crate/FrozenRouter.jsx`: 떠나는 페이지의 라우터 컨텍스트 보존.
- `src/components/crate/CratePage.jsx`: 페이지 표면과 세 가지 조명 오버레이.
- `src/components/crate/routes.js`: 메뉴 및 전환 방향 순서.
- `src/components/crate/CrateProvider.jsx`, `sfx.js`: 공통 컨트롤과 효과음.
- `src/components/doodle/`: 공유 애니메이션 타이머와 이미지 컴포넌트.
- `public/doodles/01..04/`: 원본 GIF에서 추출한 WebP 프레임.
- `Provider.jsx`, `Navbar.jsx`, `app/template.jsx`: 전역 연결. 이전 React ViewTransition과 앨범 커버 비행을 공통 전환으로 교체.
- `globals.css` 마지막 `CRATE FLIP` 블록: 전환 CSS.

React 트리를 그대로 유지하며 DOM 복제/스크린샷 전환은 사용하지 않습니다. 홈의 WebGL Canvas도 떠나는 애니메이션이 끝날 때까지 유지됩니다. FrozenRouter는 Next 내부 컨텍스트를 사용하므로 Next 버전을 올릴 때 재검증해야 합니다.

기존 intro와 홈의 치수를 유지하기 위해 전체 뷰포트 페이지 위에 불투명 고정 헤더를 두었습니다. 기존 폰트·색상·본문 레이아웃을 유지하고 전환용 토큰은 `--ct-*`로 분리했습니다. 기존 GSAP이 제어하는 요소 대신 `ct-reveal`을 붙인 제목/본문만 전환의 순차 등장 대상으로 사용합니다. 기존 홈·Digging·앨범 상세의 고유 등장 효과는 유지합니다.

## 검증

- production 빌드 및 TypeScript 검사 성공 (Supabase 환경변수는 로컬 테스트 값 사용).
- Chromium에서 일반/역방향 전환, 브라우저 뒤로가기, 실제 드래그 시작과 취소, 마지막 클릭 예약, Login→Signup 전환 확인.
- 홈 Canvas가 이전 페이지 레이어에 유지되는 것 확인.
- 모션 감소 모드, 390px 모바일 헤더 너비, 효과음 토글, 메뉴 인디케이터 위치 확인.
- 검증한 이동에서 브라우저 JavaScript 오류 없음.
- intro 원본 파일의 바이트 일치 확인.

실제 Supabase 프로젝트의 데이터 조회·인증·관리자 저장과 앨범 상세 실데이터 동작은 별도 계정/환경변수가 없어 검증하지 않았습니다. 기존의 미구현 로그인/컬렉션 기능이나 부가 페이지의 원본 콘텐츠는 그대로 두었습니다.
