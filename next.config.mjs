import {fileURLToPath} from 'node:url';

// 정적 파일(public/)의 브라우저 캐시. 기본값은 'max-age=0, must-revalidate' 라 방문할 때마다 파일 하나하나를 서버에 다시 물어봄 (방 에셋만 40여 개)
//  - 주소에 ?v= 가 붙은 것(구운 그림 · 테스트 GLB): 내용이 바뀌면 주소가 바뀌므로 1년, 다시 묻지 않음
//  - ?v= 가 없는 3D 파일(방 GLB · 구운 그림 목록): 기본값 그대로 (매번 바뀌었는지만 확인, 안 바뀌었으면 본문 없이 304)
//    — 방 GLB 와 구운 그림은 짝이 맞아야 해서, GLB 만 예전 것이 남으면 안 됨
//  - 해석기(basis · draco) · 그림 · 글꼴 · 효과음: 하루 동안은 그대로 쓰고, 그 뒤 30일까지는 일단 저장된 것을 쓰면서 뒤에서 새것을 받아 둠
//    (파일을 바꿔 배포하면 다음 방문부터 반영. 바로 반영해야 하면 주소에 ?v= 를 붙여 올릴 것)
//  개발 서버에서는 넣지 않음: GLB 를 다시 내보냈는데 예전 것이 보이면 안 되므로
const DAY = 86400;
const VERSIONED = `public, max-age=${365 * DAY}, immutable`;
const ASSET = `public, max-age=${DAY}, stale-while-revalidate=${30 * DAY}`;
const assetHeaders = process.env.NODE_ENV !== 'production' ? [] : [
  ...['/basis/:path*', '/draco/:path*', '/images/:path*', '/maplibre/:path*', '/fonts/:path*', '/sounds/:path*']
    .map((source) => ({ source, headers: [{ key: 'Cache-Control', value: ASSET }] })),
  { source: '/models/:path*', has: [{ type: 'query', key: 'v' }], headers: [{ key: 'Cache-Control', value: VERSIONED }] },
];

export default {
  turbopack: { root: fileURLToPath(new URL('.', import.meta.url)) },
  agentRules: false,
  async headers() { return assetHeaders; },
};
