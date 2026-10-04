# Grooves 홈 이미지 적용

이 ZIP의 src/와 public/을 기존 프로젝트 루트에 병합해 주세요.
기존 폴더를 삭제하지 말고 같은 경로의 파일만 덮어쓰세요.

변경 파일:
- src/components/home/HeroScene.jsx
- src/components/home/HeroSection.jsx
- public/images/grooves/listening-room.webp (새 이미지)

임시 도형을 마지막 스탠드 조명 버전의 이미지로 교체했습니다.
기존 Canvas, 종이 가장자리 효과, 마우스 오버 시 원본 색상이 드러나는 효과,
타이틀 및 무대 등장 애니메이션은 유지됩니다.
이미지는 영역을 채우도록 중앙 기준 cover 처리하므로 화면 비율에 따라 일부가 잘립니다.

추가 패키지 설치는 필요 없습니다. 완성된 3D 씬으로 전환할 때는 HeroScene.jsx를 교체하세요.

확인: 원본 ZIP과 비교해 위 JSX 두 파일 외의 src 파일은 동일합니다.
이미지 파일 및 데스크톱/모바일 비율 계산을 확인했습니다.
첨부에 package.json, lockfile, 기존 public 전체가 없어 전체 앱 실행/빌드는 검증하지 못했습니다.
