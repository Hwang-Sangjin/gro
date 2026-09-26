"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import gsap from "gsap";

const Context = createContext(null);
export const useAlbumTransition = () => useContext(Context);

// Kept outside the route subtree so the moving cover survives navigation.
export default function AlbumTransitionProvider({ children }) {
  const router = useRouter();
  const active = useRef(null);
  useEffect(() => () => active.current?.cleanup(), []);

  const openAlbum = useCallback(({ slug, color, imageUrl, source }) => {
    if (active.current || !source) return;
    const href = `/album/${encodeURIComponent(slug)}`;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const rect = source.getBoundingClientRect();
    const overlay = document.createElement("div");
    overlay.className = "album-flight";
    const background = document.createElement("div");
    background.className = "album-flight-bg";
    background.style.backgroundColor = color || "#bbcbda";
    const cover = document.createElement("div");
    cover.className = "album-flight-cover";
    Object.assign(cover.style, { left: `${rect.left}px`, top: `${rect.top}px`,
      width: `${rect.width}px`, height: `${rect.height}px`, backgroundColor: color || "#bbcbda" });
    if (imageUrl) {
      const img = document.createElement("img");
      img.src = imageUrl;
      img.alt = "";
      cover.append(img);
    }
    const status = document.createElement("span");
    status.className = "sr-only";
    status.setAttribute("role", "status");
    status.textContent = "앨범 상세로 이동 중";
    overlay.append(background, cover, status);
    document.body.append(overlay);
    document.documentElement.dataset.albumTransition = "true";
    const previousVisibility = source.style.visibility;
    source.style.visibility = "hidden";
    const page = source.closest(".page");
    const oldInert = page?.inert;
    if (page) page.inert = true;
    let frame = 0;
    let timeout;
    let timeline;
    let finished = false;
    const cleanup = () => {
      if (finished) return;
      finished = true;
      cancelAnimationFrame(frame);
      clearTimeout(timeout);
      timeline?.kill();
      gsap.killTweensOf([background, cover, overlay]);
      overlay.remove();
      source.style.visibility = previousVisibility;
      if (page) page.inert = oldInert;
      delete document.documentElement.dataset.albumTransition;
      window.removeEventListener("popstate", cleanup);
      window.removeEventListener("resize", cleanup);
      active.current = null;
    };
    active.current = { cleanup };
    window.addEventListener("popstate", cleanup);
    window.addEventListener("resize", cleanup);
    // A server error or missing target must never leave a blocking overlay.
    timeout = setTimeout(cleanup, 10000);
    const findDestination = () => {
      if (finished) return;
      if (document.querySelector("[data-album-fallback]")) {
        cleanup();
        return;
      }
      const target = document.querySelector("[data-album-cover]");
      if (!target || target.dataset.albumCover !== slug) {
        frame = requestAnimationFrame(findDestination);
        return;
      }
      const destination = target.getBoundingClientRect();
      timeline = gsap.timeline({ onComplete: () => {
        cleanup();
        document.querySelector("[data-album-heading]")?.focus({ preventScroll: true });
      } });
      timeline.to(cover, { left: destination.left, top: destination.top,
        width: destination.width, height: destination.height,
        duration: reduced ? 0 : .9, ease: "power3.inOut" })
        .to(overlay, { opacity: 0, duration: reduced ? .1 : .3 });
    };
    gsap.fromTo(background, { opacity: 0 }, { opacity: 1,
      duration: reduced ? .1 : .45, ease: "power2.out", onComplete: () => {
        router.push(href, { scroll: false });
        frame = requestAnimationFrame(findDestination);
      } });
  }, [router]);

  const value = useMemo(() => ({ openAlbum }), [openAlbum]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
