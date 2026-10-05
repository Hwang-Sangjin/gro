"use client";

import { Component, Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import HeroVinylScene from "./HeroVinylScene";
import { OrbitControls } from "@react-three/drei";

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

export default function HeroVinylCanvas() {
  return (
    <SceneErrorBoundary>
      <Canvas
        orthographic
        camera={{ position: [0, 0, 10], zoom: 80, near: 0.1, far: 100 }}
        gl={{ alpha: true, antialias: true }}
        dpr={[1, 1.5]}
        frameloop="demand"
        resize={{ offsetSize: true }}
        fallback={<div className="h-full w-full bg-transparent" />}
      >
        <Suspense fallback={null}>
          <HeroVinylScene />
        </Suspense>
        <OrbitControls
          enableZoom={false}
          enablePan={true}
          enableRotate={true}
        />
      </Canvas>
    </SceneErrorBoundary>
  );
}
