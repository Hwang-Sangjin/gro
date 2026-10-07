# Hero 인터랙션 통합

2026-10-06 업로드한 package-lock.zip을 기준으로 수정했습니다.

## 분석과 유지 사항

Next 16.3.8 / React 19 / R3F 9 / Three r180 프로젝트입니다. 최신 InkVinyl에는 StrictMode에서 model/disc 짝을 유지하는 복제 방식, 스케일 0 검사, ORTHO_EYE_DISTANCE=1000과 시선 기준 장축 빛줄기 계산이 이미 적용되어 있습니다. inkShaders.ts 전체와 InkVinyl의 빛줄기 계산 블록은 업로드 원본과 동일합니다.

각도 tilt 40°, roll 33°, 기존 반응형 크기, 크림 배경 및 헤더 테마를 유지했습니다. 레퍼런스 이미지의 어두운 배경은 이번 팔레트 변경 대상으로 해석하지 않았습니다. 기존 앨범 전용 전환/Crate Flip과 다른 홈 섹션 코드는 변경하지 않았습니다.

문서에 언급된 grooves-hero-prototype.reference.html과 introState.js는 ZIP에 없었습니다. 문서의 수치와 제공된 halo GLSL을 사용했습니다. 인트로에는 이미 동작하는 IntroContext가 있으므로 별도 중복 store 대신 useIntro().done을 연결했습니다.

## 동작

1. 패럴랙스: 마우스만, yaw 6° / pitch 2.5° / damping 3. 반지름 10에서 원점을 바라봅니다. 타이틀은 반대로 최대 14px(세로 7px). 홀드 중 강도 30%. 창 이탈/포커스 상실 때 정면 복귀.
2. 홀드 회전: 잉크 메시만 레이캐스트합니다. 판 위 왼쪽 버튼/터치 홀드 시 1.5 rad/s²로 최대 45 RPM까지 가속. 놓으면 inertia 1.4 설정으로 10 RPM 복귀. pointer capture, pointerup/cancel/lostpointercapture 및 blur 처리.
3. 커서: 즉시 따라오는 점과 0.12초 지연 링. idle/disc/drag/link/hidden. HOLD와 실시간 RPM, 회전 눈금. 모바일에는 나타나지 않으며 Hero 영역을 벗어나면 기본 커서로 복귀합니다. HTML 전역 숨김 클래스는 커스텀 커서가 실제로 보일 때만 활성화합니다.
4. SpinHalo: 제공된 6개 아크 레인·사운드 리플·잉크 튐 셰이더. 디스크 바깥 r=1~2, 로컬 y=-0.019, 4.2×4.2 평면. 최고 속도에서 화면 밖까지 퍼지는 부분은 Hero의 overflow 영역에서 잘립니다.

인트로 완료 후 1.2초 대기, 4초에 걸쳐 기본 10 RPM까지 출발합니다. 회전 하나의 omega 값을 커서와 이펙트가 공유하며, 매 프레임 React state를 갱신하지 않습니다.

모션 줄이기를 켜면 자동 회전·홀드 가속·패럴랙스·헤일로를 끕니다. 커서 위치 지연도 제거합니다. 모바일은 실제 canvas에 touch-action: pan-y를 적용해 세로 스크롤을 유지합니다. Hero가 화면 밖이거나 Crate Flip 중/탭 비활성일 때 회전과 입력을 정지합니다.

## 파일과 조절 위치

- home/heroInteraction.js: 기본 RPM, 대기, 가속, 패럴랙스, 최고 RPM, 이펙트 강도 및 mutable store.
- home/HeroInput.jsx: 미디어 설정, 포인터 위치, 가시성, 포커스, 전환 이벤트.
- home/HeroCameraParallax.jsx: 우선순위 -2의 카메라/타이틀 움직임.
- vinyl/useDiscInput.ts: 우선순위 -1의 호버 판정과 홀드 입력.
- vinyl/InkVinyl.tsx: 우선순위 -0.5의 omega 회전과 기존 빛줄기 업데이트.
- vinyl/SpinHalo.tsx, haloShaders.ts: 우선순위 0의 속도 기반 이펙트.
- home/HeroCursor.jsx: Canvas 밖 body portal DOM 커서.

스타일은 Tailwind를 사용하며 globals.css에는 기본 커서를 숨기는 미디어 규칙만 추가했습니다. Canvas는 demand 모드를 유지하고 움직임과 정면 복귀가 필요한 동안 invalidate합니다.

## 검증 환경

Next 프로덕션 빌드 및 TypeScript 검사를 수행했습니다. 실제 Chromium WebGL에서 데스크톱/모바일 크기로 확인했습니다. Supabase 요청은 빈 앨범 목록으로 대체하고 외부 폰트 요청은 차단했습니다. 실제 DB 연동과 모바일 기기의 GPU 성능 검증은 포함되지 않습니다. 상세 실행 결과는 hero-interaction-checks.json, 미리보기는 previews/hero-interactive-*.png를 참고하세요.

검증 결과: HOLD 호버, 45 RPM 상한, 판 밖 release, 놓은 뒤 감속, 빈 공간 클릭 무반응, blur 시 hidden, reduced-motion 시 패럴랙스 0과 홀드 비활성, 모바일 커서 미표시와 pan-y/실제 터치 스크롤(245px)을 확인했습니다. 헤드리스 소프트웨어 GPU에서 프레임 간격이 길어지는 경우 원본의 dt 최대 0.05 제한에 따라 실제 시간 대비 가속/감속이 느려질 수 있습니다.

기존 ZIP에 없는 /images/news/reissues.jpg 요청에서 404가 한 건 있었습니다. Hero 모델/셰이더 오류는 없었으며 News 콘텐츠는 이번 수정 범위에 포함하지 않았습니다.

## 타이틀 크기 조정

Grooves 타이틀을 22vw에서 18vw로 약 18% 줄였습니다. 추천한 짧은 잉크 아크/놓을 때 파동은 시안 단계이며, 현재 ZIP의 이펙트 코드는 이전 버전을 유지합니다.
