# Grooves — 종이 텍스처 적용

기존 프로젝트 루트에 이 ZIP의 `src`와 `public` 폴더를 병합하세요.
전체 프로젝트 폴더를 삭제하고 교체하지 마세요. package.json이나 .env는 이 ZIP에 포함되어 있지 않습니다.

## 적용 내용
- Home / New Vinyls / Genre / News: 홈 전체의 연속된 종이 배경.
- Digging: 같은 종이 질감을 조금 더 약하게 적용.
- 기존 Home 전면 SVG 노이즈, Digging SVG 노이즈는 제거해서 중복을 방지.
- 앨범 커버, Canvas, 작은 글자 위에는 텍스처를 덮지 않음.
- 기존 타이틀의 ink-grain 효과는 유지.
- 배경색은 기존 --page-bg를 사용하므로 홈 스크롤 색상 전환을 유지.
- 로딩, 페이지 전환, 데이터 조회, 레이아웃, 리빌 애니메이션 로직은 수정하지 않음.

## 변경 파일 (기존 파일 4개 + 이미지 1개)
- src/app/globals.css
- src/app/page.js
- src/app/digging/page.js
- src/components/digging/Digging.module.css
- public/images/grooves/paper-grain.webp

## 강도 및 크기 조절
`src/app/globals.css` 하단 GROOVES PAPER 블록:

```css
:root {
  --paper-texture-size: 640px;
  --paper-texture-opacity: 0.8;
}
```

- 강도: 0이면 끔, 1이면 가장 강함. 은은하게 하려면 0.4~0.6.
- 입자 크기: 480px이면 더 작고 촘촘하게, 800px이면 더 크게 보임.
- Digging 강도는 Digging.module.css의 .page 안에서 0.65로 별도 설정.
- soft-light 합성 때문에 같은 이미지가 밝은 배경과 어두운 배경에 자연스럽게 섞임.
- paper-textured 클래스를 제거하면 해당 페이지의 새 텍스처가 꺼짐.

## 이미지
이미지 생성 도구로 만든 무채색 종이 질감을 WebP로 인코딩하여 포함했습니다.
이미지 생성 프롬프트 요약: 균일한 중간 회색 바탕, 비코팅 LP 슬리브 종이,
미세한 섬유와 불규칙한 작은 입자, 반복용, 접힘·얼룩·그림자·문자 없음.
추가 패키지나 외부 이미지 서버가 필요하지 않습니다.
반복 경계나 질감 강도는 실제 사용 화면에서도 확인해 주세요.

## 검증 범위
JSX/CSS 구문 및 변경 범위를 확인했습니다.
실행 환경의 브라우저 다운로드가 실패하여 브라우저 화면 검증은 완료하지 못했습니다.
첨부에는 package.json / lockfile / 실행 설정이 없어 전체 Next.js 빌드와
Supabase 데이터가 연결된 실제 페이지의 통합 검증은 수행하지 않았습니다.
