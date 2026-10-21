import { isCoverFlightSource } from '@/lib/albumOrigin';
export const NAV = [
  { href: '/', label: 'Home' },
  { href: '/digging', label: 'Digging' },
  { href: '/collection', label: 'Collection' },
  { href: '/news', label: 'News' },
];
const extra = ['/login', '/account', '/privacy', '/terms', '/admin/albums/new', '/admin/albums/cover'];
export function rank(path) {
  const index = NAV.findIndex(p => p.href === path);
  if (index >= 0) return index;
  if (path.startsWith('/album/')) return 1.5;
  if (path.startsWith('/news/')) return 3.5;
  if (path.startsWith('/collection/')) return 2.5;   // 공개 컬렉션
  if (path.startsWith('/lab/')) return 2.8;          // Lab (Brick, Map) — Collection 과 News 사이
  const i = extra.indexOf(path);
  return i < 0 ? 20 : 4 + i;
}
export const labelFor = path => NAV.find(p => p.href === path)?.label || (path.startsWith('/album/') ? 'Album' : path.startsWith('/news/') ? 'Story' : path.startsWith('/collection/') ? 'Collection' : path === '/lab/brick' ? 'Brick' : path.split('/').filter(Boolean).at(-1) || 'Home');

// Route policy must not depend on an animation flag surviving route commits.
export function normalizedPath(path) {
  const pathname = path.split(/[?#]/)[0].replace(/\/+$/, '') || '/';
  try { return decodeURIComponent(pathname); } catch { return pathname; }
}
export function isAlbumCoverTransition(from, to) {
  return isCoverFlightSource(normalizedPath(from)) && /^\/album\/[^/]+$/.test(normalizedPath(to));
}

// 헤더 메뉴 (NAV 는 페이지 순서·전환용으로 그대로 두고, 헤더는 이 묶음으로 보여줌)
// children 이 있으면 마우스를 올렸을 때 아래로 펼쳐지는 패널. href 가 있으면 눌렀을 때 그 페이지로 (Records → Digging). soon: 아직 없는 페이지 (누를 수 없음)
export const MENU = [
  { href: '/', label: 'Home' },
  { label: 'Records', href: '/digging', children: [
    { href: '/digging', label: 'Digging', desc: '모든 판을 한 장씩 넘겨 보기', preview: 'dig' },
    { href: '/collection', label: 'Collection', desc: '내가 가진 판과 갖고 싶은 판', preview: 'shelf' },
  ] },
  { label: 'Lab', href: '/lab/brick', children: [
    { href: '/lab/brick', label: 'Brick', desc: '앨범 커버를 브릭 모자이크로', preview: 'brick' },
    { href: '/lab/map', label: 'Map', desc: '레코드숍과 LP바를 지도에서', preview: 'map', soon: true },
  ] },
  { href: '/news', label: 'News' },
];
