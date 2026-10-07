"use client";

import { useEffect, useState } from "react";
import { useThree } from "@react-three/fiber";
import { InkVinyl } from "../vinyl/InkVinyl";
import { HERO_COMPOSITION, getHeroRecordScale } from "./heroComposition";

import { HERO_MOTION } from './heroInteraction';

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

export default function HeroVinylScene({ active }) {
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
        rpm={reducedMotion ? 0 : HERO_MOTION.rpm}
        startDelay={HERO_MOTION.startDelay}
        spinEase={HERO_MOTION.spinEase}
        active={active}
      />
    </group>
  );
}
