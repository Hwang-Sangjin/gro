# Hero 4단계 — 손그림 재질

Hero의 실제 vinyl.glb에 크림색 종이와 푸른 잉크 재질을 적용했습니다. 별도의 전체 화면 필터나 이미지 대체가 아닙니다.

## 구현

- 기존 grooveMaterial.ts의 홈 마스크, 법선, anisotropy 코드는 그대로 유지합니다.
- illustratedMaterial.ts가 기존 onBeforeCompile 이후 출력 조명을 잉크 밀도로 변환합니다. 색상은 선형 공간에서 섞고 기존 Three 출력 변환을 거칩니다.
- 두 방향의 불규칙한 선을 조명 밝기에 따라 혼합합니다. 어두운 영역에서는 교차 해칭과 약한 하프톤을 더합니다.
- 모델 로컬 XZ 좌표로 선, 끊긴 동심원, 입자를 생성합니다. 시간 난수를 사용하지 않아 추후 모델 회전에도 질감이 표면에 고정됩니다.
- 초기 제안의 여러 해칭 이미지 대신 절차적 GLSL 패턴을 사용했습니다. 이미지 로딩과 UV 수정 없이 밀도와 굵기를 조절할 수 있습니다. 직접 그린 텍스처의 다양성을 완전히 재현하는 방식은 아닙니다.
- fwidth로 선과 점을 필터링하고 작은 화면에서 미세 패턴을 줄입니다. 모바일 실기기의 모아레와 GPU 성능은 별도 확인이 필요합니다.
- 중심 라벨, 가장자리도 같은 팔레트로 변경합니다. 외곽선 패스와 바닥 그림자는 다음 5단계입니다.

## 조절

src/components/vinyl/illustratedMaterial.ts의 illustrationStyle:

| 값 | 역할 |
| --- | --- |
| paper / ink / label | 종이, 잉크, 라벨 색상 |
| hatchDensity | 해칭 선 밀도 |
| ringDensity | 원형 홈 밀도 |
| strokeWidth | 선 굵기 |
| halftoneStrength | 어두운 영역의 점 강도 |

상수 변경 후 다시 렌더링/새로고침합니다. 별도 사용자 설정 UI는 추가하지 않았습니다.
VinylRecord의 illustrated prop으로 스타일을 선택하며 현재 Hero에서만 활성화합니다. false는 이전 물리 재질을 사용합니다. 생성한 재질은 언마운트 시 해제하고 원본 glTF 재질과 geometry는 공유 상태를 유지합니다.

## 검증

Next 프로덕션 빌드 및 TypeScript 검사 통과. Chromium WebGL에서 셰이더 컴파일 오류 없이 1440×900, 390×844, 844×390 화면을 확인했습니다. 로컬 모델/Draco 요청 모두 200. 실제 Supabase 연결 대신 빈 앨범 응답을 사용했으며 외부 폰트 요청은 차단했습니다. 실제 데이터 연결, 모바일 GPU 성능, 추후 마우스 애니메이션은 이번 확인 범위가 아닙니다.

스크린샷: docs/previews/vinyl-step4-*.png. 카메라와 구도는 3단계를 유지합니다.
