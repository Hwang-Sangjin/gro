"use client";
import { useCallback, useRef } from "react";
import { Canvas } from "@react-three/fiber";

import VinylFan from "./VinylFan";
import useInViewport from "./useInViewport";

const PX_PER_ITEM = 150;
const FLICK_TIME = 150;
const OVERSCROLL = 0.35;

// 진열 축의 화면 방향(오른쪽 위). VinylFan 의 STEP_X / STEP_Y 와 같은 비율
const AXIS_X = 0.91;
const AXIS_Y = -0.41;

export default function VinylShelf({ items, onActiveChange }) {
  const wrap = useRef(null);
  const scroll = useRef({ target: 0, current: 0 });
  const drag = useRef(null);
  const max = items.length - 1;

  const visible = useInViewport(wrap);

  const clamp = useCallback(
    (v) => Math.min(max + OVERSCROLL, Math.max(-OVERSCROLL, v)),
    [max],
  );

  const settle = useCallback(
    (v) => {
      scroll.current.target = Math.min(max, Math.max(0, Math.round(v)));
    },
    [max],
  );

  const onPointerDown = (e) => {
    // 마우스 좌클릭 / 터치만. 휠 클릭이나 우클릭으로 드래그가 걸리지 않게
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = {
      x: e.clientX,
      y: e.clientY,
      startTarget: scroll.current.target,
      lastP: 0,
      lastT: performance.now(),
      v: 0,
    };
  };

  const onPointerMove = (e) => {
    const d = drag.current;
    if (!d) return;

    const p = (e.clientX - d.x) * AXIS_X + (e.clientY - d.y) * AXIS_Y;

    const now = performance.now();
    const dt = Math.max(1, now - d.lastT);
    d.v = (p - d.lastP) / dt;
    d.lastP = p;
    d.lastT = now;

    scroll.current.target = clamp(d.startTarget + p / PX_PER_ITEM);
  };

  const onPointerUp = (e) => {
    const d = drag.current;
    if (!d) return;
    drag.current = null;
    e.currentTarget.releasePointerCapture?.(e.pointerId);

    const flick = (d.v * FLICK_TIME) / PX_PER_ITEM;
    settle(scroll.current.target + flick);
  };

  return (
    <div
      ref={wrap}
      className="relative h-full w-full cursor-grab touch-pan-y select-none active:cursor-grabbing"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <Canvas
        orthographic
        frameloop={visible ? "always" : "never"}
        camera={{ position: [0, 0, 12], near: 0.1, far: 100 }}
        gl={{
          alpha: true,
          antialias: true,
          powerPreference: "high-performance",
        }}
        dpr={[1, 1.75]}
      >
        <VinylFan
          items={items}
          scrollRef={scroll}
          onActiveChange={onActiveChange}
        />
      </Canvas>
    </div>
  );
}
