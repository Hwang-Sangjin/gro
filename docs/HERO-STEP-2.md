# Hero 2단계 — 사용자 GLB 및 Claude 홈 셰이더 통합

## 적용

- public/models/vinyl.glb: 제공한 원본 바이너리 그대로 포함.
- src/components/vinyl/grooveMaterial.ts: Claude의 홈 마스크/AA/노멀/이방성 3단계 GLSL 계산 유지. 패치 청크 존재 검사와 캐시 키만 추가.
- src/components/vinyl/VinylRecord.tsx: Material.002만 교체. 라벨 Material.001, 테두리 Material.003은 원본 유지. 재질 배열도 처리.
- src/components/home/HeroVinylScene.jsx: 원점 기준 균일 스케일, 임시 기울기, 로컬 RoomEnvironment 및 키라이트.
- src/components/home/HeroVinylCanvas.jsx: 클라이언트 Canvas, 오류 경계, 모델 로딩 Suspense.
- src/components/home/HeroSection.jsx: 기존 큰 Grooves 앞 레이어 유지, 새 Hero 스타일은 Tailwind 사용.
- HeroSection.module.css 제거: Hero 레이아웃을 동등한 Tailwind 클래스로 이전.
- public/draco/: Three 배포본의 glTF용 WASM 디코더와 라이선스. 외부 Draco CDN 불필요.

## Claude 코드와 통합 차이

Three r169 코드의 include 지점과 anisotropyT/B/alphaT를 현재 r180 소스에서 확인했습니다. 셰이더 계산식은 변경하지 않았습니다. React 19용 ThreeElements 타입으로 변경하고, useGLTF(url, '/draco/')를 사용합니다. 로딩 캐시의 공유 지오메트리/재질이 제거되지 않도록 primitive에 dispose={null} 적용, 직접 만든 grooves 재질만 dispose합니다. 파라미터 변경 후 demand Canvas를 invalidate합니다.

환경맵은 외부 HDR 다운로드 대신 RoomEnvironment를 PMREM으로 생성합니다. intensity 0.55, key light 2.2입니다. effect 정리 시 환경맵 복원과 렌더 타깃 dispose를 수행합니다.

2단계 범위에 맞춰 Hero는 rpm=0, frameloop=demand입니다. 검정 바이닐과 빨간 라벨을 유지했습니다. 손그림 재질/궤적/입자/마우스/등장 연출은 아직 추가하지 않았습니다. 카메라와 기울기는 모델이 보이도록 임시 배치한 것이며 3단계에서 시안에 맞춰 조정합니다. 추후 rpm을 활성화할 때는 Canvas 렌더 루프도 함께 활성화해야 합니다.

## 검증

- 원본 GLB: Draco 압축, 재질 3개, 총 6,656 triangles. 제공 파일과 배포 모델의 SHA-256 일치.
- Production 빌드 및 TypeScript 검사 통과. 최초 시도에서 발생한 Turbopack 캐시 오류는 생성 캐시를 지우고 재빌드하여 해결.
- 실제 Three r180 ShaderLib에 onBeforeCompile 적용: include 패치, 이방성 필드, uniform 참조, 청크 누락 검사 통과.
- Chromium(소프트웨어 렌더링)에서 실제 홈페이지 확인: GLB / Draco JS / Draco WASM 모두 HTTP 200, 모델과 grooves 렌더링, WebGL 셰이더/JS 예외 없음.
- 1440×900 및 390×844 확인 이미지: docs/previews/.
- 브라우저 확인은 Supabase 응답을 빈 목록으로 대체했습니다. 실제 DB·인증은 검증하지 않았습니다. 외부 PP Neue Montreal 폰트 요청은 차단했으며 이 요청의 실패 로그는 별도로 구분했습니다. Hero Bodoni는 로컬 폰트입니다.

## 적용

전체 프로젝트 ZIP입니다. 기존 서버 종료 후 새 폴더에 압축을 풀고 기존 .env.local을 복사하세요. npm ci, npm run dev로 실행합니다. 원본 handoff는 docs/history/VINYL-SHADER-HANDOFF.txt에 포함했습니다.
