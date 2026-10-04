export const NAV = [
  { href: '/', label: 'Home', doodle: '03' },
  { href: '/digging', label: 'Digging', doodle: '01' },
  { href: '/collection', label: 'Collection', doodle: '02' },
  { href: '/news', label: 'News', doodle: '04' },
];
const extra = ['/login', '/signup', '/info', '/projects', '/admin/albums/new', '/admin/albums/cover'];
export function rank(path) {
  const index = NAV.findIndex(p => p.href === path);
  if (index >= 0) return index;
  if (path.startsWith('/album/')) return 1.5;
  const i = extra.indexOf(path);
  return i < 0 ? 20 : 4 + i;
}
export const labelFor = path => NAV.find(p => p.href === path)?.label || (path.startsWith('/album/') ? 'Album' : path.split('/').filter(Boolean).at(-1) || 'Home');

// Route policy must not depend on an animation flag surviving route commits.
export function normalizedPath(path) {
  const pathname = path.split(/[?#]/)[0].replace(/\/+$/, '') || '/';
  try { return decodeURIComponent(pathname); } catch { return pathname; }
}
export function isAlbumCoverTransition(from, to) {
  return ['/', '/digging'].includes(normalizedPath(from)) && /^\/album\/[^/]+$/.test(normalizedPath(to));
}
