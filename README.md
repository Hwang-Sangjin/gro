# Grooves — Full-page Crate Flip

2026-10-04 수정본. 제공된 원본 프로젝트 전체에 크레이트 플립을 통합했습니다. 최신 동작은 **헤더와 본문이 하나의 페이지로 함께 넘어가는 전환**입니다.

## 실행

```bash
npm ci
cp .env.example .env.local
# 기존 Supabase 환경변수를 .env.local에 입력
npm run dev
```

```bash
npm run build
npm start
```

원본 ZIP에는 루트 설정 파일이 없어 실행용 설정을 추가했습니다. Next.js 16.3.8 / React 19.2.4 / Tailwind 4 조합입니다. 기존 프로젝트에 옮길 때 환경변수를 유지하세요. 비밀키와 테스트 DB 설정은 포함하지 않았습니다.

## 헤더와 배경

- Navbar는 전역 Provider가 아닌 각 `CratePage` 안에 있습니다. 스크롤할 때는 페이지 위쪽에 머무르고, 라우트 전환 때는 본문과 동일한 transform·opacity·조명을 받습니다.
- 떠나는 페이지와 들어오는 페이지가 각각 자신의 헤더·활성 메뉴·배경색을 유지합니다. 새 pathname 때문에 기존 브라운색 헤더가 크림색으로 먼저 바뀌지 않습니다.
- 홈은 해당 페이지 레이어의 `--wire-t`로 헤더와 본문 색상을 함께 계산합니다. 문서 전체 색상 변수를 변경하지 않습니다.
- 종이 텍스처가 적용된 Home/Digging은 헤더에도 같은 이미지·크기·블렌딩·불투명도를 사용합니다. 홈에서는 스크롤에 따라 패턴 위치도 맞춥니다.
- 앨범 상세의 헤더는 해당 앨범 배경색과 대비 글자색을 사용합니다. 기본 페이지들은 기존 크림색을 사용합니다.
- 활성 메뉴 표시선은 각 헤더에 속합니다. 이전의 화면에 고정된 헤더와 이동 인디케이터는 제거했습니다.

## 전환 범위

intro 완료 후 App Router 경로 변경에 적용합니다. Home/Digging/Collection/News/Login/Signup/앨범 상세 및 기존 부가 경로를 포함합니다. 최초 로딩과 intro → 첫 화면은 기존 연출을 유지하며 `src/components/intro/` 파일들은 수정하지 않았습니다.

같은 경로의 쿼리 변경·페이지 내 앵커, 외부 링크, 새 창, 다운로드는 기존 동작을 유지합니다.

전환 수식은 기존 명세의 perspective 2400px, origin 50% -25%, 기본 1300ms, 역방향 t=1→0, shade/cast/spec 및 슬리브 3장을 유지합니다. 전환 중 페이지와 헤더 입력을 함께 잠급니다. 프로그램으로 들어온 후속 이동 요청은 마지막 목적지를 예약합니다.

하단 핸들에서 아래로 끌면 다음 메뉴, 위로 끌면 이전 메뉴입니다. 진행률 30% 또는 속도 0.55px/ms 기준으로 확정하며, 미달하면 복귀합니다. 헤더 또는 핸들에서 방향키/PageUp/PageDown도 지원합니다. 전환이 끝나면 제목으로 포커스를 옮깁니다. 모션 감소 설정에서는 짧은 페이드와 정지 doodle을 사용합니다.

드래그 취소는 기존 명세처럼 router.replace로 출발 주소를 복원합니다. 취소 직후 브라우저 기록에 같은 출발 주소가 연속으로 남을 수 있습니다.

## 버벅임 개선

- 매 프레임 메뉴의 getBoundingClientRect를 읽고 인디케이터 위치를 다시 계산하던 작업을 제거했습니다. 프레임 렌더러는 transform·opacity를 쓰는 작업만 합니다.
- 홈 배경색 계산은 상시 RAF 폴링 대신 scroll/resize/콘텐츠 크기 변경 시에만 실행합니다. 플립 중에는 색상과 패턴 위치를 유지합니다.
- 전환 중 홈의 Canvas는 demand 모드로 전환하여 반복 렌더링을 줄입니다. 기존 WebGL/React 인스턴스를 제거하거나 DOM으로 복제하지 않습니다. 완료·취소 후 기존 가시성 기반 재생을 복원합니다.
- 전환 중 doodle 프레임 구독을 쉬게 하여 반복 React 업데이트를 줄입니다.
- inert·z-index·정적 스타일은 전환 준비 단계에서 한 번 설정합니다. 전환 시계는 첫 RAF 콜백에서 시작합니다.
- 페이지 표면에 layout/paint containment를 적용합니다.

Canvas가 축소된 채 남는 이전 오류 수정도 유지합니다. Hero와 New Vinyls 모두 `resize={{ offsetSize: true }}`로 변형 전 레이아웃 크기를 측정합니다.

## 주요 파일

- `src/components/crate/CratePage.jsx`: 헤더 + 콘텐츠 + 조명 오버레이.
- `src/components/crate/CrateStage.jsx`: 라우트 수명, RAF, 드래그/취소, 포커스.
- `src/components/crate/render.js`: 전환 준비 및 순수 진행도 수식.
- `src/components/crate/FrozenRouter.jsx`: 떠나는 페이지의 React 트리 유지.
- `src/components/crate/routes.js`: 메뉴와 전환 방향 순서.
- `src/components/Navbar.jsx`: 페이지별 메뉴. 경로는 해당 레이어의 props로 받습니다.
- `src/components/home/useWireProgress.js`: 페이지별 스크롤 색상/패턴 위치.
- `src/components/home/HeroSection.jsx`, `VinylShelf.jsx`: Canvas 측정 및 전환 중 재생 정책.
- `src/components/doodle/`: 공유 WebP 프레임 타이머.
- `src/app/globals.css`: 마지막 Crate Flip 및 Full-page 스타일.

FrozenRouter는 Next 내부 컨텍스트를 사용하므로 Next 버전을 올릴 때 다시 검증해야 합니다.

## 검증 범위

- Chromium에서 브라운색 홈 → Collection 전환의 각 샘플을 확인: 기존 헤더 색상/활성 메뉴 유지, 서로 다른 헤더 2개가 각 페이지에 귀속, 헤더 좌표가 페이지와 함께 이동.
- 실행 중 앱에서 헤더 레이아웃을 반복 측정하지 않는 것 확인.
- 헤더와 본문 텍스처 이미지 일치 확인.
- 뒤로가기, 드래그 취소 후 단일 헤더 복원, 모션 감소, 390px 모바일, 브라우저 JavaScript 오류 없음.
- 실제 DB 대신 로컬 테스트 앨범 7개 사용. 실제 인증·DB 쓰기는 수행하지 않았습니다.
- Production 빌드와 TypeScript 검사 통과.

테스트 환경의 소프트웨어 GPU 프레임 속도는 실제 사용자 기기의 성능 보장 수치로 사용하지 않았습니다. 기존 미구현 로그인/컬렉션 기능과 원본 부가 페이지 콘텐츠는 그대로입니다.
