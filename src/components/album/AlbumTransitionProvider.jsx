'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import gsap from 'gsap';
import { useCrate } from '../crate/CrateProvider';
import { normalizedPath, isAlbumCoverTransition } from '../crate/routes';
import { createSleeveFaces } from './sleeveDepth';

const Context = createContext(null);
export const useAlbumTransition = () => useContext(Context);

export default function AlbumTransitionProvider({ children }) {
  const router = useRouter();
  const { go, bridge, busy, setBusy } = useCrate();
  const active = useRef(null);
  const finish = useCallback(() => {
    const flight = active.current;
    if (!flight) return;
    active.current = null;
    clearTimeout(flight.timeout);
    cancelAnimationFrame(flight.frame);
    flight.observer?.disconnect();
    flight.tween?.kill();
    flight.overlay.remove();
    if (flight.source) flight.source.style.visibility = flight.visibility;
    if (flight.stage) flight.stage.inert = flight.wasInert;
    delete bridge.current.albumFlightPath;
    delete document.documentElement.dataset.albumTransition;
    setBusy(false);
  }, [bridge, setBusy]);

  const openAlbum = useCallback(({ slug, color, imageUrl, source }) => {
    if (!slug || active.current || busy) return;
    const href = `/album/${encodeURIComponent(slug)}`;
    // Home New Vinyls and Digging share the same cover flight.
    if (!isAlbumCoverTransition(location.pathname, href)) { go(href); return; }
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const box = source?.getBoundingClientRect();
    const overlay = document.createElement('div');
    overlay.className = 'album-flight';
    overlay.setAttribute('aria-hidden', 'true');
    const background = document.createElement('div');
    background.className = 'album-flight-bg';
    background.style.backgroundColor = color || '#bbcbda';
    const cover = document.createElement('div');
    cover.className = 'album-flight-cover';
    cover.style.backgroundColor = color || '#bbcbda';
    if (imageUrl) {
      const image = document.createElement('img');
      image.src = imageUrl;
      image.alt = '';
      cover.append(image);
    }
    // 슬리브 두께(위·오른쪽 면): Digging 호버와 앨범 상세와 같은 비율이라 날아가는 동안에도 그대로 이어짐
    cover.append(...createSleeveFaces(color));
    overlay.append(background, cover);
    document.body.append(overlay);
    gsap.set(background, { opacity: 0 });
    if (box && !reduced) gsap.set(cover, { left: box.left, top: box.top, width: box.width, height: box.height });
    else cover.style.display = 'none';
    const stage = document.querySelector('[data-crate-stage]');
    const flight = { overlay, source, stage, wasInert: stage?.inert, visibility: source?.style.visibility, frame: 0, landing: false };
    active.current = flight;
    if (stage) stage.inert = true;
    if (source && !reduced) source.style.visibility = 'hidden';
    bridge.current.albumFlightPath = href;
    document.documentElement.dataset.albumTransition = 'true';
    setBusy(true);
    flight.timeout = setTimeout(finish, 10000);

    const land = () => {
      if (active.current !== flight || flight.landing) return;
      const page = [...document.querySelectorAll('[data-crate-path]')].find(node => normalizedPath(node.dataset.cratePath) === normalizedPath(href));
      if (!page) return;
      if (page.querySelector('[data-album-fallback]')) { finish(); return; }
      const target = [...page.querySelectorAll('[data-album-cover]')].find(node => node.dataset.albumCover === slug);
      if (!target) return;
      const rect = target.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      flight.landing = true;
      flight.observer.disconnect();
      flight.frame = requestAnimationFrame(() => {
        if (active.current !== flight) return;
        const destination = target.getBoundingClientRect();
        flight.tween = gsap.timeline({ onComplete: () => {
          finish();
          const heading = page.querySelector('h1,h2');
          heading?.setAttribute('tabindex', '-1');
          heading?.focus({ preventScroll: true });
        } });
        if (box && !reduced) flight.tween.to(cover, {
          left: destination.left, top: destination.top,
          width: destination.width, height: destination.height,
          duration: 0.9, ease: 'power3.inOut',
        });
        flight.tween.to(overlay, { opacity: 0, duration: reduced ? 0.12 : 0.3 });
      });
    };
    flight.tween = gsap.to(background, { opacity: 1, duration: reduced ? 0.12 : 0.45, onComplete: () => {
      if (active.current !== flight) return;
      flight.observer = new MutationObserver(land);
      flight.observer.observe(document.querySelector('[data-crate-stage]'), { childList: true, subtree: true });
      router.push(href, { scroll: false });
      land();
    } });
  }, [bridge, busy, finish, go, router, setBusy]);

  // The capture listener always calls the latest provider implementation.
  useEffect(() => {
    bridge.current.openAlbum = openAlbum;
    return () => {
      if (bridge.current.openAlbum === openAlbum) delete bridge.current.openAlbum;
    };
  }, [bridge, openAlbum]);

  useEffect(() => {
    window.addEventListener('popstate', finish);
    window.addEventListener('resize', finish);
    return () => {
      window.removeEventListener('popstate', finish);
      window.removeEventListener('resize', finish);
      finish();
    };
  }, [finish]);
  const value = useMemo(() => ({ openAlbum }), [openAlbum]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
