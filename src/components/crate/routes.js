import { COVER_FLIGHT_SOURCES } from '@/lib/albumOrigin';
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
  const i = extra.indexOf(path);
  return i < 0 ? 20 : 4 + i;
}
export const labelFor = path => NAV.find(p => p.href === path)?.label || (path.startsWith('/album/') ? 'Album' : path.startsWith('/news/') ? 'Story' : path.split('/').filter(Boolean).at(-1) || 'Home');

// Route policy must not depend on an animation flag surviving route commits.
export function normalizedPath(path) {
  const pathname = path.split(/[?#]/)[0].replace(/\/+$/, '') || '/';
  try { return decodeURIComponent(pathname); } catch { return pathname; }
}
export function isAlbumCoverTransition(from, to) {
  return COVER_FLIGHT_SOURCES.includes(normalizedPath(from)) && /^\/album\/[^/]+$/.test(normalizedPath(to));
}
