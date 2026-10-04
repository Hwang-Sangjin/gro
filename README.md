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
