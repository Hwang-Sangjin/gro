# 사라진 GIF / 문구 복구

아래 두 파일을 기존 프로젝트의 같은 경로에 전체 교체하세요.
- src/components/home/HomeDecoration.jsx
- src/components/home/HomeDecoration.css

이전 패치의 오류:
HomeDecoration.jsx에서 JSX 반환부가 useEffect 정리 함수 위치에 잘못 들어갔습니다.
이를 effect 종료 후 컴포넌트의 반환부로 복원했습니다.
타이머 취소와 IntersectionObserver 해제도 복구했습니다.

반응형 정책:
- 768px 미만: GIF와 문구 숨김
- 일반 데스크톱/태블릿: 섹션 아래에 GIF와 문구 표시 (최대 400px)
- 충분히 넓은 화면: 기존 좌우 배치 (최대 560px)
  Hero/New 3168px 이상, Category/News 2848px 이상
- 섹션 아래 배치 시 다음 콘텐츠와 겹치지 않도록 공간을 확보합니다.
- GIF 등장 후 문구 리빌, Hero 씬 동기화는 유지합니다.

실제 Next.js 앱 빌드/렌더링은 제공 소스의 실행 설정 부재로 확인하지 못했습니다.
