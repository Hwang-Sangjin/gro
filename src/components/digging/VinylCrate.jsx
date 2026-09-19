"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";

import VinylStack from "./VinylStack";

const PX_PER_ITEM = 90; // 한 칸 넘기는 데 필요한 세로 드래그 거리
const WHEEL_PX_PER_ITEM = 160; // 휠은 드래그보다 둔하게
const FLICK_TIME = 120;
const OVERSCROLL = 0.35;
const DRAG_THRESHOLD = 6; // 이 이상 움직이면 클릭이 아니라 드래그

export default function VinylCrate({ items }) {
  const scroll = useRef({ target: 0, current: 0 });
  const selectedRef = useRef(null);
  const drag = useRef(null);
  const wheelSnap = useRef(0);
  const wrapper = useRef(null);

  const [active, setActive] = useState(0);
  const [selected, setSelected] = useState(null);

  const max = items.length - 1;

  const setSelectedBoth = useCallback((value) => {
    selectedRef.current = value;
    setSelected(value);
  }, []);

  const snapTo = useCallback(
    (value) => {
      scroll.current.target = Math.min(max, Math.max(0, Math.round(value)));
    },
    [max],
  );

  // 클릭: 같은 카드면 닫고, 다른 카드면 그 카드로 스냅한 뒤 펼친다
  const onSelect = useCallback(
    (i) => {
      if (drag.current?.moved) return;
      if (selectedRef.current === i) {
        setSelectedBoth(null);
        return;
      }
      snapTo(i);
      setSelectedBoth(i);
    },
    [snapTo, setSelectedBoth],
  );

  // ── 드래그. window 리스너를 써야 R3F 의 클릭 판정이 살아남는다 (pointer capture 는 canvas 이벤트를 가로챈다)
  const onPointerDown = (e) => {
    if (e.button !== 0) return;
    drag.current = {
      startY: e.clientY,
      startTarget: scroll.current.target,
      lastY: e.clientY,
      lastT: performance.now(),
      v: 0,
      moved: false,
    };
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp, { once: true });
  };

  const onPointerMove = (e) => {
    const d = drag.current;
    if (!d) return;

    const dy = e.clientY - d.startY;
    if (!d.moved && Math.abs(dy) > DRAG_THRESHOLD) {
      d.moved = true;
      // 펼쳐진 상태에서 드래그를 시작하면 먼저 닫는다
      if (selectedRef.current !== null) setSelectedBoth(null);
    }
    if (!d.moved) return;

    const now = performance.now();
    const dt = Math.max(1, now - d.lastT);
    d.v = (e.clientY - d.lastY) / dt;
    d.lastY = e.clientY;
    d.lastT = now;

    // 아래로 끌면 앞쪽(작은 인덱스)으로
    const raw = d.startTarget - dy / PX_PER_ITEM;
    scroll.current.target = Math.min(
      max + OVERSCROLL,
      Math.max(-OVERSCROLL, raw),
    );
  };

  const onPointerUp = () => {
    window.removeEventListener("pointermove", onPointerMove);
    const d = drag.current;
    if (!d) return;

    if (d.moved) {
      const flick = (-d.v * FLICK_TIME) / PX_PER_ITEM;
      snapTo(scroll.current.target + flick);
    }
    // 클릭 판정(R3F onClick)이 이 뒤에 오므로 moved 는 다음 틱에 지운다
    setTimeout(() => (drag.current = null), 0);
  };

  // ── 휠. React 의 onWheel 은 passive 라 preventDefault 가 안 먹으므로 네이티브로 건다
  useEffect(() => {
    const el = wrapper.current;
    if (!el) return;

    const onWheel = (e) => {
      e.preventDefault();
      if (selectedRef.current !== null) setSelectedBoth(null);

      const raw = scroll.current.target + e.deltaY / WHEEL_PX_PER_ITEM;
      scroll.current.target = Math.min(
        max + OVERSCROLL,
        Math.max(-OVERSCROLL, raw),
      );

      clearTimeout(wheelSnap.current);
      wheelSnap.current = setTimeout(() => snapTo(scroll.current.target), 120);
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      el.removeEventListener("wheel", onWheel);
      clearTimeout(wheelSnap.current);
    };
  }, [max, snapTo, setSelectedBoth]);

  const vinyl = items[active];

  return (
    <div className="flex flex-col gap-6">
      <div
        ref={wrapper}
        data-lenis-prevent
        className="relative h-[70svh] min-h-[420px] w-full cursor-grab touch-none select-none overflow-hidden active:cursor-grabbing"
        onPointerDown={onPointerDown}
      >
        <Canvas
          camera={{ position: [0, 3.4, 4.6], fov: 38 }}
          gl={{ alpha: true, antialias: true }}
          dpr={[1, 2]}
          onCreated={({ camera }) => camera.lookAt(0, 0.5, -1.4)}
        >
          <VinylStack
            items={items}
            scrollRef={scroll}
            selectedRef={selectedRef}
            onSelect={onSelect}
            onActiveChange={setActive}
          />
        </Canvas>
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] items-baseline gap-4 text-[0.9rem]">
        <span className="opacity-60">
          {String(active + 1).padStart(2, "0")} /{" "}
          {String(items.length).padStart(2, "0")}
        </span>
        <p className="text-center">
          <strong className="font-medium">{vinyl.title}</strong>
          <span className="opacity-70">
            {" "}
            / {vinyl.artist} — LP · {vinyl.year} · {vinyl.genre}
          </span>
        </p>
        <span className="justify-self-end text-[0.8rem] uppercase tracking-[0.14em] opacity-50">
          {selected === null ? "Drag · Click to open" : "Click again to close"}
        </span>
      </div>
    </div>
  );
}
