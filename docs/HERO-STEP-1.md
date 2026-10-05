# Hero 1단계 — 전체 화면 레이아웃

## 구성

Hero 영역을 100svh로 고정하고, 투명 R3F Canvas를 전체 영역에 배치했습니다. Canvas 앞에 HTML Grooves 타이틀을 크게 중앙 정렬했습니다. 타이틀 레이어는 pointer-events:none으로 두어 이후 Canvas 마우스 효과를 방해하지 않습니다.

- HeroSection.jsx: Canvas와 타이틀 레이어
- HeroSection.module.css: 전체 화면 및 반응형 타이틀 크기
- HeroVinylScene.jsx: 모델을 연결할 원점 기준 group

현재 모델이 없으므로 화면에는 중앙의 큰 Grooves만 표시되는 것이 정상입니다. 배경은 기존 종이 질감이 투명 Canvas 뒤로 보입니다. 마우스 효과나 등장 애니메이션은 추가하지 않았습니다. 기존 인트로와 페이지 전환은 유지됩니다.

Canvas는 demand 모드로 정지 상태의 불필요한 반복 렌더링을 피합니다. resize.offsetSize로 페이지 전환 transform과 레이아웃 측정을 분리했습니다. 기본 orthographic 카메라는 임시값이며 모델을 받은 뒤 크기와 기울기를 조정합니다.

## 모델 전달

가능하면 텍스처가 포함된 GLB 파일로 전달하세요. 바이닐 중심에 원점(pivot)을 두고, 원판과 중앙 라벨을 별도 mesh로 구성하면 이후 재질과 회전을 조정하기 쉽습니다. 이미 다른 형식으로 제작 중이면 원본 그대로 전달해도 됩니다.

## 검증

Production 빌드 및 TypeScript 검사 통과. 실제 브라우저 시각 검증은 미수행.

## 적용

전체 프로젝트 ZIP입니다. 기존 서버를 종료하고 새 폴더에 압축을 푼 뒤 .env.local을 복사하여 npm ci, npm run dev로 실행하세요. 변경 파일만 적용할 경우 위 3개 파일을 함께 교체/추가하세요.
