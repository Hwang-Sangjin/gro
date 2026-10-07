"use client";

import { Component, Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import HeroVinylScene from "./HeroVinylScene";
import HeroCameraParallax from './HeroCameraParallax';
import HeroInput from './HeroInput';

class SceneErrorBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error) {
    console.error("Hero vinyl could not load", error);
  }
  render() {
    if (this.state.failed)
      return <span className="sr-only">3D 모델을 불러오지 못했습니다.</span>;
    return this.props.children;
  }
}

export default function HeroVinylCanvas({ sectionRef, titleRef, active }) {
  return (
    <SceneErrorBoundary>
      <Canvas
        className="touch-pan-y select-none"
        style={{ touchAction: "pan-y" }}
        orthographic
        camera={{ position: [0, 0, 10], zoom: 80, near: 0.1, far: 100 }}
        gl={{ alpha: true, antialias: true }}
        dpr={[1, 1.5]}
        frameloop="demand"
        resize={{ offsetSize: true }}
        fallback={<div className="h-full w-full bg-transparent" />}
      >
        <HeroInput sectionRef={sectionRef} active={active} />
        <HeroCameraParallax titleRef={titleRef} />
        <Suspense fallback={null}>
          <HeroVinylScene active={active} />
        </Suspense>

      </Canvas>
    </SceneErrorBoundary>
  );
}
