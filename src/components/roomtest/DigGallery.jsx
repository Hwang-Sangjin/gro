"use client";
// 끝없이 끌어서 둘러보는 앨범 갤러리 (Home New Vinyls) — 레코드 가게 바닥에 펼쳐진 판들 사이를 손으로 밀어 가며 고르는 느낌
//  - 정해진 칸(열 × 행) 수만큼만 DOM 을 만들고, 이동량을 더한 좌표를 반복 영역(폭 × 높이)으로 감아서 다시 씀 → 오래 끌어도 DOM 이 늘지 않음
//  - 반복 영역은 화면보다 사방으로 한 칸 이상 크게 잡아서, 커버와 글자가 화면 밖으로 완전히 나간 뒤에만 반대편으로 옮겨짐
//  - 끄는 동안에는 React 렌더 없이 requestAnimationFrame 에서 transform 만 바꿈
//  - 손을 떼면 짧은 관성. 일정 거리(DRAG.threshold) 이상 움직였으면 앨범이 열리지 않음
//  - 키보드: Tab 으로 앨범 이동(포커스한 앨범이 화면 가운데로 옴), 화살표로 한 칸씩 이동, Enter 로 열기
import { useEffect, useLayoutEffect, useRef, useState } from "react";

// ── 조정 값 ─────────────────────────────────────────────────
// 2026-11-15: 레퍼런스(197historiasilustradas.com)처럼 작은 커버를 넓은 간격으로 흩어 놓은 넓은 판. 글자는 커버 위(번호 · 제목)와 아래(아티스트)에 작게
export const GALLERY = {
  cover: [104, 0.07, 160],   // 커버 한 변: [최소 px, 화면 폭 비율, 최대 px]
  gapX: 0.95,                // 가로 여백 = 커버 × 이 값
  gapY: 0.62,                // 세로 여백 = 커버 × 이 값
  caption: 46,               // 커버 위·아래 글자 칸 높이 합(px)
  stagger: 0.5,              // 홀수 열을 세로로 칸 높이의 이만큼 내림 (엇갈림)
  spare: 1,                  // 화면 밖으로 사방에 더 두는 칸 수 (재배치가 화면에서 보이지 않게)
};
export const DRAG = {
  threshold: 6,              // 이만큼(px) 움직이면 클릭이 아니라 끌기
  friction: 0.92,            // 관성: 프레임(60fps)마다 속도에 곱하는 값. 작을수록 빨리 멈춤
  maxSpeed: 60,              // 손을 뗄 때 속도 상한(px/프레임)
  fling: 14,                 // 터치로 세로로 밀다 뗐을 때 페이지가 더 미끄러지는 거리 = 속도(px/프레임) × 이 값
  keyStep: 1,                // 화살표 한 번에 움직이는 칸 수
};

const mod = (a, n) => ((a % n) + n) % n;

function layout(w) {
  const cover = Math.round(Math.min(GALLERY.cover[2], Math.max(GALLERY.cover[0], w * GALLERY.cover[1])));
  const cellW = Math.round(cover * (1 + GALLERY.gapX));
  const cellH = Math.round(cover + GALLERY.caption + cover * GALLERY.gapY);
  return { cover, cellW, cellH };
}

/** albums: [{ slug, title, artist, image, color }] · onOpen(event, album, coverEl) · label: 영역 이름
 *  scrollDrift: 페이지 스크롤 1px 에 판들이 위로 흘러가는 거리 (0 = 안 움직임). 가장 가까운 [data-nv-track] 이 붙어 있는(sticky) 동안만 */
export default function DigGallery({ albums, onOpen, label = "New vinyls — drag to dig", scrollDrift = 0 }) {
  const root = useRef(null);
  const items = useRef([]);
  const [grid, setGrid] = useState(null);   // { cols, rows, cover, cellW, cellH, W, H } — 화면 크기가 바뀔 때만 바뀜
  const [touched, setTouched] = useState(false);   // 한 번이라도 끌었으면 안내를 숨김
  const st = useRef({ x: 0, y: 0, sy: 0, vx: 0, vy: 0, raf: 0, drag: null, moved: false, reduced: false, target: null });

  // 화면 크기 → 칸 수 (DOM 개수는 이때만 바뀜)
  useLayoutEffect(() => {
    const el = root.current;
    if (!el) return;
    st.current.reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const measure = () => {
      const w = el.clientWidth, h = el.clientHeight;
      if (!w || !h) return;
      const { cover, cellW, cellH } = layout(w);
      const cols = Math.ceil(w / cellW) + 2 * GALLERY.spare + 1;
      const rows = Math.ceil(h / cellH) + 2 * GALLERY.spare + 1;
      setGrid((g) => (g && g.cols === cols && g.rows === rows && g.cover === cover ? g : { cols, rows, cover, cellW, cellH, W: cols * cellW, H: rows * cellH, vw: w, vh: h }));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // 좌표 → transform (렌더 없이)
  const place = () => {
    const g = grid; if (!g) return;
    const s = st.current, ox = g.cellW * GALLERY.spare, oy = g.cellH * GALLERY.spare;
    for (let i = 0; i < items.current.length; i++) {
      const el = items.current[i]; if (!el) continue;
      const c = i % g.cols, r = Math.floor(i / g.cols);
      const bx = c * g.cellW, by = r * g.cellH + (c % 2 ? g.cellH * GALLERY.stagger : 0);
      // 반복 영역 안에서 감기: 화면 왼쪽·위로 spare 칸 만큼 나간 자리부터 시작
      const x = mod(bx + s.x + ox, g.W) - ox + (g.cellW - g.cover) / 2;
      const y = mod(by + s.y + s.sy + oy, g.H) - oy;
      el.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0)`;
    }
  };
  const placeRef = useRef(place);
  placeRef.current = place;

  // 처음 위치: 첫 앨범 열이 화면 가운데쯤 오게
  useLayoutEffect(() => {
    if (!grid) return;
    const s = st.current;
    if (!s.started) { s.x = Math.round(grid.vw / 2 - grid.cellW * (GALLERY.spare + 0.5)); s.y = Math.round(grid.cellH * 0.18); s.started = true; }
    place();
  });   // eslint-disable-line react-hooks/exhaustive-deps

  // 움직임 루프: 끄는 중이거나 관성이 남아 있을 때만 돎
  const loop = () => {
    const s = st.current;
    s.raf = 0;
    if (s.target) {   // 키보드: 목표 지점으로 부드럽게
      const k = s.reduced ? 1 : 0.16;
      s.x += (s.target.x - s.x) * k; s.y += (s.target.y - s.y) * k;
      if (Math.hypot(s.target.x - s.x, s.target.y - s.y) < 0.5) { s.x = s.target.x; s.y = s.target.y; s.target = null; }
    } else if (!s.drag) {
      s.x += s.vx; s.y += s.vy;
      const f = s.reduced ? 0 : DRAG.friction;
      s.vx *= f; s.vy *= f;
      if (Math.abs(s.vx) < 0.05 && Math.abs(s.vy) < 0.05) { s.vx = 0; s.vy = 0; }
    }
    placeRef.current();
    if (s.drag || s.target || s.vx || s.vy) s.raf = requestAnimationFrame(loop);
  };
  const kick = () => { const s = st.current; if (!s.raf) s.raf = requestAnimationFrame(loop); };
  useEffect(() => () => cancelAnimationFrame(st.current.raf), []);

  // 스크롤에 맞춰 흘러감 (Route 66 의 붙어 있는 장면처럼: 화면이 멈춰 있는 동안에도 휠을 굴리면 그만큼 움직임)
  //  Lenis 가 스크롤을 옮긴 그 프레임에 바로 자리를 다시 씀 (page:lenis-scroll). 구간 위치는 크기가 바뀔 때만 잼
  useEffect(() => {
    const el = root.current, page = el?.closest(".page"), track = el?.closest("[data-nv-track]");
    if (!page || !track || !scrollDrift || st.current.reduced) return;
    let start = 0, len = 0;
    const cache = () => {
      start = track.getBoundingClientRect().top - page.getBoundingClientRect().top + page.scrollTop;
      len = Math.max(0, track.offsetHeight - page.clientHeight);
    };
    const update = () => {
      const s = st.current;
      const sy = -Math.min(len, Math.max(0, page.scrollTop - start)) * scrollDrift;
      if (Math.abs(sy - s.sy) < 0.05) return;
      s.sy = sy;
      placeRef.current();
    };
    const ro = new ResizeObserver(() => { cache(); update(); });
    ro.observe(track); ro.observe(page);
    page.addEventListener("page:lenis-scroll", update);
    page.addEventListener("scroll", update, { passive: true });
    cache(); update();
    return () => { ro.disconnect(); page.removeEventListener("page:lenis-scroll", update); page.removeEventListener("scroll", update); };
  }, [scrollDrift]);

  // ── 끌기 (Pointer Events)
  const onPointerDown = (e) => {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    const s = st.current;
    // 터치: 처음 움직인 방향으로 정함 — 세로면 페이지 스크롤(다음 섹션으로 내려갈 수 있게), 가로면 판을 옆으로 넘김
    //  (예전: 터치를 전부 갤러리가 가져가서 휴대폰에서 아래로 스크롤하기 힘들었음)
    s.drag = { id: e.pointerId, x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now(), captured: false, touch: e.pointerType === "touch", axis: null, pv: 0 };
    s.moved = false; s.vx = 0; s.vy = 0; s.target = null;
  };
  const onPointerMove = (e) => {
    const s = st.current, d = s.drag;
    if (!d || d.id !== e.pointerId) return;
    const dx = e.clientX - d.x, dy = e.clientY - d.y;
    if (!s.moved && Math.hypot(e.clientX - d.sx, e.clientY - d.sy) > DRAG.threshold) {
      s.moved = true;
      root.current.setPointerCapture(e.pointerId);   // 끌기로 바뀐 뒤에만 잡음 → 그냥 누른 건 링크 클릭으로 남음
      root.current.dataset.dragging = "true";
      if (!touched) setTouched(true);
    }
    if (!s.moved) return;
    const now = performance.now(), dt = Math.max(1, now - d.t);
    if (d.touch) {
      d.axis ??= Math.abs(e.clientY - d.sy) > Math.abs(e.clientX - d.sx) ? "y" : "x";
      if (d.axis === "y") {
        const page = root.current.closest(".page");
        if (page) page.dispatchEvent(new CustomEvent("page:scrollto", { detail: { top: page.scrollTop - dy } }));
        d.pv = 0.6 * d.pv + 0.4 * (dy / dt) * 16.7;
        d.x = e.clientX; d.y = e.clientY; d.t = now;
        return;
      }
      s.x += dx;
      s.vx = 0.6 * s.vx + 0.4 * (dx / dt) * 16.7; s.vy = 0;
      d.x = e.clientX; d.y = e.clientY; d.t = now;
      kick();
      return;
    }
    s.x += dx; s.y += dy;
    // 손을 뗄 때 쓸 속도 (px/프레임, 60fps 기준), 튀는 값은 섞어서 고르게
    s.vx = 0.6 * s.vx + 0.4 * (dx / dt) * 16.7;
    s.vy = 0.6 * s.vy + 0.4 * (dy / dt) * 16.7;
    d.x = e.clientX; d.y = e.clientY; d.t = now;
    kick();
  };
  const onPointerUp = (e) => {
    const s = st.current, d = s.drag;
    if (!d || d.id !== e.pointerId) return;
    s.drag = null;
    delete root.current.dataset.dragging;
    if (s.moved) {
      // 끈 뒤 손을 뗄 때 생기는 클릭은 버림 (Crate 의 문서 단계 클릭 처리보다 먼저: window 의 capture)
      const stop = (ev) => { ev.preventDefault(); ev.stopPropagation(); };
      window.addEventListener("click", stop, { capture: true, once: true });
      setTimeout(() => window.removeEventListener("click", stop, { capture: true }), 0);
      if (d.axis === "y") {
        // 세로로 민 손을 떼면 페이지가 조금 더 미끄러짐
        const page = root.current.closest(".page");
        const v = performance.now() - d.t > 80 ? 0 : Math.max(-DRAG.maxSpeed, Math.min(DRAG.maxSpeed, d.pv));
        if (page && Math.abs(v) > 1) page.dispatchEvent(new CustomEvent("page:scrollto", { detail: { top: page.scrollTop - v * DRAG.fling, smooth: !s.reduced, duration: 0.9, easing: (t) => 1 - Math.pow(1 - t, 3) } }));
        return;
      }
      if (performance.now() - d.t > 80) { s.vx = 0; s.vy = 0; }   // 멈췄다 놓으면 관성 없음
      const sp = Math.hypot(s.vx, s.vy);
      if (sp > DRAG.maxSpeed) { s.vx *= DRAG.maxSpeed / sp; s.vy *= DRAG.maxSpeed / sp; }
      kick();
    }
  };

  // ── 키보드
  const moveBy = (dx, dy) => {
    const s = st.current, g = grid; if (!g) return;
    const base = s.target ?? { x: s.x, y: s.y };
    s.target = { x: base.x + dx, y: base.y + dy }; s.vx = s.vy = 0;
    if (!touched) setTouched(true);
    kick();
  };
  const onKeyDown = (e) => {
    const g = grid; if (!g) return;
    const k = { ArrowLeft: [1, 0], ArrowRight: [-1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] }[e.key];
    if (!k) return;
    e.preventDefault();
    moveBy(k[0] * g.cellW * DRAG.keyStep, k[1] * g.cellH * DRAG.keyStep);
  };
  // Tab 으로 앨범에 오면 그 앨범이 화면 안(가운데 쪽)으로 오게
  const onFocus = (e) => {
    const a = e.target.closest?.("[data-gallery-item]"); if (!a || !grid) return;
    if (st.current.drag || !a.matches(":focus-visible")) return;   // 마우스로 누를 때 생기는 포커스는 무시 (끌기와 겹치지 않게)
    const r = a.getBoundingClientRect(), box = root.current.getBoundingClientRect();
    const cx = r.left + r.width / 2 - (box.left + box.width / 2), cy = r.top + r.height / 2 - (box.top + box.height / 2);
    if (Math.abs(cx) > box.width * 0.3 || Math.abs(cy) > box.height * 0.3) moveBy(-cx, -cy);
  };

  // 칸 → 앨범: 줄마다 시작을 밀어서 같은 앨범이 위아래·옆에 붙지 않게
  const n = albums.length;
  const cells = grid && n ? Array.from({ length: grid.cols * grid.rows }, (_, i) => {
    const c = i % grid.cols, r = Math.floor(i / grid.cols);
    return albums[mod(c + r * 3, n)];
  }) : [];
  const firstSeen = new Set();

  return (
    <div ref={root} role="region" aria-label={label} tabIndex={0} onKeyDown={onKeyDown} onFocusCapture={onFocus}
      onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}
      data-crate-ignore
      data-lenis-prevent-touch
      className="group/gal relative h-full w-full cursor-grab touch-none select-none overflow-hidden outline-none focus-visible:ring-2 focus-visible:ring-(--accent) focus-visible:ring-inset data-[dragging=true]:cursor-grabbing"
      style={{ "--cover": grid ? `${grid.cover}px` : "200px" }}>
      {cells.map((a, i) => {
        // 같은 앨범은 처음 한 칸만 Tab 으로 옴 (반복된 칸은 화면용)
        const first = !firstSeen.has(a.slug); firstSeen.add(a.slug);
        return (
          <a key={`${a.slug}:${i}`} ref={(el) => { items.current[i] = el; }} data-gallery-item href={`/album/${encodeURIComponent(a.slug)}`} title={`${a.title} — ${a.artist}`}
            tabIndex={first ? 0 : -1} aria-hidden={first ? undefined : true}
            data-album-slug={a.slug} data-album-color={a.color} data-album-image={a.image}
            onClick={(e) => onOpen?.(e, a, e.currentTarget.querySelector("[data-album-source]"))}
            draggable={false}
            className="group/item absolute left-0 top-0 block w-(--cover) will-change-transform outline-none"
            aria-label={`${a.title} — ${a.artist}`}>
            {/* 커버 위: 번호 · 제목 (레퍼런스처럼 작은 대문자 한 줄) */}
            <span className="mb-1.5 flex items-baseline gap-2 text-[10px] font-medium uppercase leading-none tracking-[0.12em]">
              <span className="shrink-0 tabular-nums opacity-55">{String((albums.indexOf(a) + 1)).padStart(2, "0")}.</span>
              <span className="truncate">{a.title}</span>
            </span>
            <span data-album-source className="block aspect-square overflow-hidden shadow-[0_8px_16px_-12px_rgba(40,26,34,.55)] transition-[translate,box-shadow] duration-500 ease-groove group-hover/item:-translate-y-1.5 group-hover/item:shadow-[0_18px_28px_-16px_rgba(40,26,34,.6)] group-focus-visible/item:-translate-y-1.5 group-focus-visible/item:ring-2 group-focus-visible/item:ring-(--accent) motion-reduce:transition-none motion-reduce:group-hover/item:translate-y-0"
              style={{ backgroundColor: a.color }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={a.image} alt="" loading="eager" decoding="async" draggable={false} className="pointer-events-none size-full select-none object-cover" />
            </span>
            <span className="mt-1.5 block truncate text-[10px] uppercase leading-none tracking-[0.12em] opacity-55">{a.artist}</span>
          </a>
        );
      })}

      {/* 처음 안내: 한 번 끌면 사라짐 */}
      <div aria-hidden="true" className={`pointer-events-none absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center gap-3 rounded-full bg-(--ink) px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.3em] text-(--cream) shadow-[0_12px_30px_-12px_rgba(0,0,0,.5)] transition-[opacity,scale] duration-500 ease-groove ${touched || !n ? "scale-90 opacity-0" : "scale-100 opacity-100"}`}>
        <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
          <path d="M12 3v18M3 12h18M12 3l-2.5 2.5M12 3l2.5 2.5M12 21l-2.5-2.5M12 21l2.5-2.5M3 12l2.5-2.5M3 12l2.5 2.5M21 12l-2.5-2.5M21 12l-2.5 2.5" />
        </svg>
        Drag to dig
      </div>
      <p className="sr-only">Drag, use the arrow keys, or press Tab to move between albums. Press Enter to open one.</p>
    </div>
  );
}
