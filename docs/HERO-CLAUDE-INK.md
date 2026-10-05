# Hero — Claude 잉크 드로잉 재질로 교체

사용자가 전달한 VINYL-INK-CLAUDE-HANDOFF.txt의 잉크 스타일을 적용했습니다. 이 문서가 HERO-STEP-4.md의 재질 설명보다 우선합니다.

## 적용 내용

- Hero에서 InkVinyl을 사용합니다. 세 GLB 프리미티브를 하나의 ShaderMaterial로 렌더합니다.
- Claude의 Kajiya-Kay 빛줄기, 반지름 노이즈, hatch 평균 톤 필터, premultiplied 투명 출력을 유지했습니다.
- 면은 투명하여 기존 CSS 종이 질감이 비칩니다. 잉크 #4f6d93, 라벨 #bbcbda와 문서의 파라미터 기본값을 사용합니다.
- 동심원 홈과 불꽃처럼 끊기는 밀도 변화, 라벨 장식선, 외곽선, 두께 1.8의 옆면 해칭, 바닥 스케치 그림자를 적용했습니다. 그림자와 외곽선은 기존 계획상 5단계였지만 이번 제공 스타일에 포함되어 함께 통합했습니다.
- 이전 illustratedMaterial.ts를 제거했습니다. PBR용 VinylRecord.tsx와 grooveMaterial.ts는 별도 사용을 위해 유지합니다.

## 통합 보완

- 기존 3단계 직교 카메라와 대각선 구도를 유지합니다. 문서 예제의 추가 모델 이동/기울기는 중복 적용하지 않았습니다.
- Hero는 rpm=0, followPointer=false로 현재 정지 상태를 유지합니다. 컴포넌트 기능은 남겨 두었으며 둘 중 하나를 활성화하면 demand Canvas에서 다음 프레임을 요청합니다. 회전/커서 효과의 디자인 검증은 후속 단계입니다.
- Draco는 기존 로컬 /draco/를 사용하며 서버 preload를 하지 않습니다.
- depth 프리패스가 원본 메시의 위치, 회전, 배율을 복사하도록 보완했습니다. 공유 GLB 리소스는 dispose하지 않고 생성한 재질만 해제합니다.
- 그림자의 패턴 좌표를 평면 로컬 좌표로 변경했습니다. 기존 예제의 world XZ는 Hero의 배율/기울기에서 패턴이 어긋나기 때문입니다. hatch와 noise 수식은 유지했습니다.
- 문서에서 누락된 반지름/높이 props의 uniform 갱신과 정적 렌더 invalidate를 연결했습니다.
- 원본처럼 sRGB 숫자를 직접 출력하고 별도 색 공간 변환 청크를 넣지 않습니다. toneMapped=false를 명시했습니다.
- RoomEnvironment와 directionalLight는 잉크 셰이더가 자체 광원 방향을 사용하므로 Hero에서 제거했습니다. PBR 셰이더 내부는 변경하지 않았습니다.

## 조절

src/components/vinyl/inkShaders.ts: inkDefaults와 GLSL.
src/components/vinyl/InkVinyl.tsx: 잉크/라벨 색, 회전, 커서, 두께 props.
src/components/home/HeroVinylScene.jsx: 현재 Hero 사용 설정.

## 검증

프로덕션 빌드와 TypeScript 검사 통과. Chromium WebGL에서 desktop 1440×900, mobile 390×844, landscape 844×390 렌더 확인. 셰이더 오류 및 런타임 예외 없음. 모델/Draco 리소스 모두 200. 외부 폰트는 테스트에서 차단했으며 Supabase는 빈 앨범 응답으로 대체했습니다. 실제 DB와 모바일 GPU 성능은 이번 검증에 포함되지 않습니다.

미리보기는 docs/previews/vinyl-claude-ink-*.png에 있습니다.
