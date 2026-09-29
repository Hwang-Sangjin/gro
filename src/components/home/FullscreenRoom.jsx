"use client";
import { Suspense, useEffect, useRef } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import HeroScene from "./HeroScene";

export default function FullscreenRoom({ onClose, returnFocusRef }) {
  const dialogRef = useRef(null);
  const closeRef = useRef(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    const trigger = returnFocusRef.current;
    const page = trigger?.closest(".page");
    const overflow = page?.style.overflow;
    if (page) page.style.overflow = "hidden";
    dialog.showModal();
    closeRef.current?.focus();
    return () => {
      dialog.close();
      if (page) page.style.overflow = overflow;
      trigger?.focus({ preventScroll: true });
    };
  }, [returnFocusRef]);

  return <dialog ref={dialogRef} className="grooves-room-dialog" aria-label="Grooves 3D 리스닝 룸"
    data-lenis-prevent onCancel={event => { event.preventDefault(); onClose(); }}>
    <Canvas camera={{ position: [7.2, 5.4, 9], fov: 42 }} dpr={[1, 1.5]} gl={{ antialias: true }}>
      <Suspense fallback={null}><HeroScene /></Suspense>
      <OrbitControls makeDefault target={[0, 1.3, -.5]} enablePan={false}
        minDistance={7} maxDistance={19} minPolarAngle={.4} maxPolarAngle={1.45}
        minAzimuthAngle={-.2} maxAzimuthAngle={1.25} />
    </Canvas>
    <button ref={closeRef} type="button" className="grooves-room-close" onClick={onClose} aria-label="전체화면 닫고 홈으로 돌아가기">×</button>
    <p className="grooves-room-help">Drag to look around · Scroll to zoom · Esc to close</p>
  </dialog>;
}
