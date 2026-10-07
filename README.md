# Grooves

바이닐 탐색·앨범 감상 웹 프로젝트. Next.js App Router, React, R3F/Three.js, GSAP, Lenis, Supabase를 사용합니다.

## 실행

```bash
npm ci
cp .env.example .env.local
# .env.local에 기존 Supabase 프로젝트의 환경변수를 입력
npm run dev
```

Windows에서는 `.env.example`을 복사해 `.env.local`로 이름을 바꿔도 됩니다. 관리자 API에는 서버용 서비스 키와 ADMIN_SECRET이 필요합니다. 실제 키는 저장소에 커밋하지 않습니다.

```bash
npm run typecheck
npm run build
npm start
```

## 폴더 안내

| 경로 | 역할 |
| --- | --- |
| `src/app/` | 페이지, 레이아웃, 관리자·상태 확인 API |
| `src/components/intro/` | 로딩 및 인트로 |
| `src/components/crate/` | 헤더와 페이지를 함께 넘기는 Crate Flip |
| `src/components/home/` | Hero 3D 룸, 새 앨범, 장르, 뉴스 |
| `src/components/digging/` | 앨범 탐색 그리드와 reveal |
| `src/components/album/` | 앨범 상세, YouTube 재생, 이동 API |
| `src/components/doodle/` | WebP 프레임 장식 애니메이션 |
| `src/components/layout/` | 페이지 스크롤 컨테이너 |
| `src/lib/` | 데이터 조회·가공, 테마, 이미지 처리 |
| `src/utils/supabase/` | 브라우저·서버 Supabase 클라이언트 |
| `public/doodles/` | 4종 × 6장의 애니메이션 프레임 |
| `public/images/` | 현재 사용 중인 로고, 종이 패턴, 뉴스 대체 이미지 |
| `public/fonts/` | Bodoni Moda 폰트와 라이선스 |
| `docs/CLEANUP.md` | 이번 정리의 변경·삭제 목록과 검증 범위 |
| `docs/history/` | 과거 적용 안내 및 변경 이력 |

스타일은 `src/app/globals.css`와 각 컴포넌트의 CSS/CSS Modules에서 관리합니다. 현재 디자인에 영향을 주는 전역 스타일의 순서는 유지했습니다.

## 수정할 때 참고

- 홈 구조: `src/app/page.js`
- 헤더: `src/components/Navbar.jsx`
- 전환 동작: `src/components/crate/CrateStage.jsx`, `render.js`
- 3D 룸: `src/components/home/ListeningRoomScene.jsx`
- 앨범 조회: `src/lib/albums.js`, `recent-vinyls.js`
- 장르 목록: `src/lib/genres.js`
- 패키지 버전과 lock 파일은 제공된 버전을 유지했습니다.
- Next 내부 컨텍스트를 사용하는 `FrozenRouter.jsx`는 Next 업그레이드 때 검증이 필요합니다.

과거 문서에는 현재 제거된 구현 설명이 포함되어 있습니다. 현재 실행 코드와 이 README를 우선합니다.

## 앨범 전용 전환 복원

Digging → Album Detail은 커버 이동 전환을 사용합니다. 다른 페이지 이동은 Crate Flip을 유지합니다. 상세 변경은 `docs/ALBUM-TRANSITION-FIX.md`를 참고하세요.

현재 전달 버전: **album-transition-v2**. 클릭 캡처와 라우트 확정 두 단계에서 Digging → Album을 전용 전환으로 분기합니다.

## 최신 Home 수정

Home New Vinyls에도 앨범 커버 이동 전환 적용. Hero는 정적인 Grooves 텍스트만 표시합니다. `docs/HOME-HERO-UPDATE.md`가 이전 Home 설명보다 우선합니다.

## 최신 Hero 1단계

전체 화면 투명 R3F Canvas와 중앙의 큰 Grooves 타이틀을 구성했습니다. 모델은 아직 없으며 `HeroVinylScene.jsx`에 연결할 예정입니다. `docs/HERO-STEP-1.md` 참고.

## 최신 Hero 2단계

사용자 vinyl.glb와 Claude의 절차적 grooves 셰이더를 연결했습니다. 모델은 정지 상태로 표시됩니다. `docs/HERO-STEP-2.md`와 `docs/previews/`를 참고하세요.

## 최신 Hero 3단계

직교 카메라와 대각선 타원 구도, 화면 비율에 따른 모델 크기를 조정했습니다. 최신 내용은 `docs/HERO-STEP-3.md`, 미리보기는 `docs/previews/vinyl-step3-*.png`를 참고하세요. 4단계 손그림 재질은 아직 미적용입니다.

## 최신 Hero 4단계

크림색·푸른 잉크의 절차적 해칭, 끊긴 원형 grooves, 약한 하프톤 재질을 Hero에 적용했습니다. `docs/HERO-STEP-4.md`가 이전 단계의 재질 설명보다 우선합니다. 외곽선·바닥 그림자는 5단계에서 진행합니다.

## 최신 Hero: Claude 잉크 스타일

제공된 InkVinyl/inkShaders 기반의 투명 잉크 드로잉 재질로 교체했습니다. 종이 배경, 방사형 동심원 잉크선, 블루 라벨, 외곽선과 스케치 그림자를 사용합니다. 최신 내용은 `docs/HERO-CLAUDE-INK.md`를 참고하세요.

## 최신 Hero: 인터랙션 4종

마우스 카메라 패럴랙스, 홀드로 45 RPM까지 가속, HOLD/RPM 커서, 속도 반응 아크·리플·잉크 튐을 통합했습니다. 인트로 종료 후 출발하며 모바일 스크롤과 모션 줄이기를 지원합니다. `docs/HERO-INTERACTIONS.md`가 최신 구현 설명입니다.
