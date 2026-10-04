# Home 변경 — 2026-10-04

이 문서가 기존 전환 문서의 Home Crate 유지 설명보다 우선합니다.

- Home New Vinyls와 Digging에서 앨범을 선택하면 동일한 커버 이동 전환을 사용합니다.
- 대표색 0.45초 → 상세 라우팅 → 실제 커버 위치로 0.9초 이동 → 0.3초 페이드 → 디스크/정보 등장.
- VinylShelf가 제공하는 3D 앨범의 화면 좌표를 전환 시작 위치로 사용합니다. 클릭과 Enter가 같은 activate 함수를 사용합니다.
- 일반 메뉴 이동은 Crate Flip을 유지합니다.
- HeroSection은 정적인 Grooves 텍스트만 렌더링합니다. 기존 Hero GSAP/SplitText, 3D Canvas, 전체화면 버튼, 장식·문구·로고·스크롤 안내는 렌더링하지 않습니다.
- 사이트 최초 로딩 Preloader는 유지합니다.
- 이전 3D 룸 소스는 이후 Hero 작업의 참고를 위해 파일로 남아 있으나 Hero에서 import하지 않습니다.

## 이번 수정 파일

- src/components/album/AlbumTransitionProvider.jsx
- src/components/crate/CrateStage.jsx
- src/components/crate/routes.js
- src/components/home/HeroSection.jsx
- src/components/home/HeroSection.module.css (추가)

## 검증

프로덕션 빌드 및 TypeScript 검사 통과. 실제 코드 기반 모의 DOM/router/GSAP 테스트에서 Home과 Digging 커버 이동, 중복 클릭, 모션 감소, 정리 동작, 다른 경로 Crate 분기 통과. 실제 브라우저 시각 및 Supabase 연결 검증은 미수행.

## 적용

전체 프로젝트가 포함되어 있습니다. 새 폴더에 압축을 풀고 기존 .env.local을 복사한 뒤 npm ci, npm run dev로 실행하세요.
