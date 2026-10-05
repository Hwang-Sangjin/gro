"use client";

import { useEffect, useState } from "react";
import { useThree } from "@react-three/fiber";
import { InkVinyl } from "../vinyl/InkVinyl";
import { HERO_COMPOSITION, getHeroRecordScale } from "./heroComposition";

/** 히어로 회전 속도. 실제 턴테이블(33⅓)보다 훨씬 느리게 — 배경처럼 은은하게 */
const HERO_RPM = 10;
/** 홈 진입 후 멈춰 있는 시간(초) */
const HERO_START_DELAY = 1.2;
/** 정지 → HERO_RPM까지 가속 시간(초) */
const HERO_SPIN_EASE = 4;

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return reduced;
}

export default function HeroVinylScene() {
  const viewport = useThree((state) => state.viewport);
  const pixelHeight = useThree((state) => state.size.height);
  const reducedMotion = usePrefersReducedMotion();
  // Uniform scaling preserves the shader's model-space radii.
  const scale = getHeroRecordScale(
    viewport.width,
    viewport.height,
    pixelHeight,
  );
  return (
    <group
      name="hero-vinyl-root"
      rotation={[0, 0, HERO_COMPOSITION.roll]}
      scale={scale}
    >
      <InkVinyl
        followPointer={false}
        rotation={[HERO_COMPOSITION.tilt, 0, 0]}
        rpm={reducedMotion ? 0 : HERO_RPM}
        startDelay={HERO_START_DELAY}
        spinEase={HERO_SPIN_EASE}
        /* 인트로(로딩)가 있다면 끝난 시점에 true를 넘기면 그때부터 대기·출발:
           active={introDone} */
      />
    </group>
  );
}
