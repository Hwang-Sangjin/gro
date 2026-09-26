"use client";
import { useEffect, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { useRouter } from "next/navigation";
import { coverUrl } from "@/lib/albums";
import { useAlbumTransition } from "@/components/album/AlbumTransitionProvider";
import VinylFan from "./VinylFan";
import useInViewport from "./useInViewport";
import { AXIS_X, AXIS_Y, clamp, dragTarget, releaseTarget } from "./vinyl-layout.mjs";

export default function VinylShelf({ items, onActiveChange }) {
  const wrap = useRef(null);
  const source = useRef(null);
  const activationRef = useRef(null);
  const interaction = useRef({ dragging: false, suppressClick: false });
  const transition = useAlbumTransition();
  const router = useRouter();
  function activate(index, rect) {
    const album = items[index];
    if (!album?.slug) return;
    if (!transition || !source.current) { router.push(`/album/${encodeURIComponent(album.slug)}`); return; }
    const parent = wrap.current.getBoundingClientRect();
    Object.assign(source.current.style, { left: `${rect.left - parent.left}px`, top: `${rect.top - parent.top}px`,
      width: `${rect.width}px`, height: `${rect.height}px` });
    transition.openAlbum({ slug: album.slug, color: album.cover_color,
      imageUrl: coverUrl(album.cover_path || album.thumb_path), source: source.current });
  }
  const scroll = useRef({ target: 0, current: 0 });
  const drag = useRef(null);
  const visible = useInViewport(wrap);
  const [entered, setEntered] = useState(false);
  useEffect(() => {
    const element = wrap.current;
    if (!element) return;
    if (!("IntersectionObserver" in window)) {
      setEntered(true);
      return;
    }
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      setEntered(true);
      observer.disconnect();
    }, { root: element.closest(".page"), threshold: .25 });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const max = Math.max(0, items.length - 1);
  const onPointerDown = (e) => {
    if (e.button !== 0 || !e.isPrimary || drag.current) return;
    interaction.current = { dragging: false, suppressClick: false };
    drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY,
      start: scroll.current.target, lastP: 0, lastT: performance.now(), v: 0,
      pixels: Math.min(210, Math.max(90, e.currentTarget.clientWidth * .15)) };
  };
  const onPointerMove = (e) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 6) {
      interaction.current = { dragging: true, suppressClick: true };
      if (!e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.setPointerCapture(e.pointerId);
    }
    if (!interaction.current.dragging) return;
    const p = (e.clientX-d.x)*AXIS_X + (e.clientY-d.y)*AXIS_Y;
    const now = performance.now();
    d.v = (p-d.lastP) / Math.max(1, now-d.lastT);
    d.lastP = p; d.lastT = now;
    // Invert both drag and release velocity: left/down advances the catalogue.
    scroll.current.target = dragTarget(d.start, p, d.pixels, max);
  };
  const finish = (e, cancelled = false) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    drag.current = null;
    interaction.current.dragging = false;
    if (cancelled) interaction.current.suppressClick = true;
    scroll.current.target = releaseTarget(scroll.current.target, d.v,
      performance.now()-d.lastT, d.pixels, max, cancelled);
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
  };
  return (
    <div ref={wrap} role="group" aria-label="새 바이닐 탐색. 좌우 방향키로 앨범을 이동하고 Enter로 상세를 엽니다."
      tabIndex={0} className="relative h-full w-full cursor-grab touch-pan-y select-none active:cursor-grabbing"
      onPointerDown={onPointerDown} onPointerMove={onPointerMove}
      onPointerUp={e => finish(e)} onPointerCancel={e => finish(e,true)}
      onLostPointerCapture={e => finish(e,true)}
      onKeyDown={e => {
        if (e.key === "Enter") {
          e.preventDefault(); interaction.current.suppressClick = false;
          activationRef.current?.(clamp(Math.round(scroll.current.target), max)); return;
        }
        if (!["ArrowLeft","ArrowRight","Home","End"].includes(e.key)) return;
        e.preventDefault();
        scroll.current.target = e.key === "Home" ? 0 : e.key === "End" ? max :
          clamp(Math.round(scroll.current.target)+(e.key === "ArrowRight" ? 1 : -1),max);
      }}>
      <span ref={source} aria-hidden="true" className="pointer-events-none absolute" />
      <Canvas orthographic flat frameloop={visible ? "always" : "never"}
        camera={{ position: [0,0,20], near: .1, far: 100 }}
        gl={{ alpha: true, antialias: true }} dpr={[1,1.75]}>
        <VinylFan entered={entered} items={items} scrollRef={scroll} onActiveChange={onActiveChange} onActivate={activate} activationRef={activationRef} interactionRef={interaction} />
      </Canvas>
    </div>
  );
}
