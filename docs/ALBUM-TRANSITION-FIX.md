# 앨범 전환 복원 v2 — 2026-10-04

이 문서의 v2 수정이 아래 최초 복원 설명보다 우선합니다.

## v2에서 추가한 수정

- CrateStage의 document capture 클릭 단계에서 Digging → Album 링크를 먼저 분기하고 AlbumTransitionProvider를 직접 호출합니다.
- DiggingGrid에 커버 DOM·이미지·색상·slug를 식별하는 data 속성을 추가했습니다.
- 라우트 확정 단계에서도 출발 /digging → 목적 /album/[slug]는 Crate Flip을 실행하지 않습니다. 임시 albumFlightPath 상태에 의존하지 않습니다.
- 슬래시 및 URI 인코딩 차이를 정규화합니다.
- 각 Provider가 자기 bridge 필드만 정리하도록 수정했습니다. 개발 모드 effect 재실행 시에도 핸들러를 다시 등록합니다.
- 홈과 일반 메뉴 간 이동의 Crate Flip은 유지합니다.

## 적용할 파일 (6개 모두 함께 적용)

1. src/components/album/AlbumTransitionProvider.jsx
2. src/components/album/AlbumDetailView.jsx
3. src/components/digging/DiggingGrid.jsx
4. src/components/crate/CrateStage.jsx
5. src/components/crate/routes.js
6. src/app/globals.css

전체 정리본 ZIP입니다. 기존 실행 서버를 종료한 뒤 새 폴더에 압축을 풀고 기존 .env.local을 복사하세요. npm ci 후 npm run dev로 시작합니다. 기존 폴더에서 적용한다면 위 6개 파일을 모두 교체하고 개발 서버를 재시작하세요.

## v2 검증

- 실제 CrateStage 클릭 핸들러 코드를 실행한 테스트: 앨범 클릭은 cover flight 호출, Crate go 호출 0회. Ctrl 클릭 유지. 다른 메뉴는 Crate go 호출.
- 실제 route commit effect 코드를 실행한 테스트: 전용 상태값이 없어도 단일 상세 페이지로 교체, Crate Flip용 2개 페이지 생성 안 함.
- 대표색 → 라우팅 → 실측 커버 이동, 중복 클릭, 모션 감소, 홈 분기, 언마운트 정리 테스트 통과.
- 최종 프로덕션 빌드 및 TypeScript 검사 통과.
- 브라우저 바이너리 설치 실패로 실제 브라우저 시각 검증은 수행하지 못했습니다. 실제 DB 연동도 검증하지 않았습니다.

---

# Digging → Album 전용 전환 복원

## 원인

전달받은 프로젝트의 AlbumTransitionProvider가 slug만 CrateProvider.go로 전달하고 color/imageUrl/source를 사용하지 않았습니다. CrateStage의 capture 클릭 핸들러도 앨범 링크를 먼저 가로챘습니다. 이전 정리본은 사용되지 않던 album-flight CSS를 제거했습니다.

## 복원

- DiggingGrid의 앨범 링크에 data-crate-skip 추가. 수정 키/새 탭 클릭은 일반 링크 동작 유지.
- AlbumTransitionProvider에서 대표색 배경 0.45초 → 라우팅 → 커버를 상세 DOM 위치로 0.9초 이동 → 오버레이 0.3초 페이드 복원.
- 목적지 데이터/DOM이 준비될 때까지 유지하고, 오류/404/10초 제한/뒤로가기/리사이즈/언마운트 시 오버레이·잠금 정리.
- body에 오버레이를 만들어 CrateStage transform 영향 방지. 입력 잠금 및 중복 클릭 방지.
- 앨범 전용 목적지에 대해서만 CrateStage를 즉시 교체하여 이중 전환 방지.
- 상세 디스크와 정보 reveal은 앨범 전용 전환이 끝난 뒤 시작.
- 모션 감소에서는 커버 이동 생략, 짧은 페이드만 적용.
- 홈 New Vinyls와 나머지 페이지 이동은 현재 Crate Flip 유지.

## 수정 파일

- src/components/album/AlbumTransitionProvider.jsx
- src/components/album/AlbumDetailView.jsx
- src/components/digging/DiggingGrid.jsx
- src/components/crate/CrateStage.jsx
- src/app/globals.css

## 검증

- Production 빌드 및 TypeScript 검사 통과.
- 모의 DOM/router/GSAP 테스트: 배경 완료 후 라우팅, 상세 실측 좌표 이동, 중복 클릭 차단, 모션 감소, 홈 Crate 분기, 언마운트 정리 통과.
- 실제 Supabase 연결 및 브라우저 시각 검증은 수행하지 않았습니다.

정리된 전체 프로젝트에 적용된 버전입니다. 기존 .env.local은 유지하세요.
