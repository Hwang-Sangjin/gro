'use client';
import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { heroInteraction as s, heroIsActive } from '../home/heroInteraction';
export function useDiscInput(targets: THREE.Mesh[]) {
  const { gl, camera, invalidate } = useThree();
  const ray = useMemo(() => new THREE.Raycaster(), []);
  const ndc = useMemo(() => new THREE.Vector2(), []);
  const heldId = useRef<number | null>(null);
  const release = useRef<() => void>(() => {});
  const hit = (x: number, y: number) => {
    const canvas = gl.domElement, rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height || document.elementFromPoint(x, y) !== canvas) return false;
    camera.updateMatrixWorld();
    for (const mesh of targets) mesh.updateWorldMatrix(true, false);
    if (!targets.length || Math.abs(targets[0].matrixWorld.determinant()) < 1e-10) return false;
    ndc.set((x - rect.left) / rect.width * 2 - 1, -(y - rect.top) / rect.height * 2 + 1);
    ray.setFromCamera(ndc, camera);
    return ray.intersectObjects(targets, false).length > 0;
  };
  useEffect(() => {
    const canvas = gl.domElement;
    const end = (e?: PointerEvent) => {
      if (e && heldId.current !== e.pointerId) return;
      const id = heldId.current; heldId.current = null; s.holding = false;
      if (id !== null && canvas.hasPointerCapture(id)) canvas.releasePointerCapture(id);
      invalidate();
    };
    release.current = () => end();
    const down = (e: PointerEvent) => {
      if (!heroIsActive() || s.reduced || heldId.current !== null || e.button !== 0 || !hit(e.clientX, e.clientY)) return;
      heldId.current = e.pointerId; s.holding = true; s.hoverDisc = true;
      canvas.setPointerCapture(e.pointerId);
      if (e.pointerType === 'mouse') e.preventDefault();
      invalidate();
    };
    const menu = (e: MouseEvent) => { if (s.holding || hit(e.clientX, e.clientY)) e.preventDefault(); };
    canvas.addEventListener('pointerdown', down);
    canvas.addEventListener('contextmenu', menu);
    canvas.addEventListener('lostpointercapture', end);
    window.addEventListener('pointerup', end); window.addEventListener('pointercancel', end);
    window.addEventListener('blur', release.current);
    return () => {
      canvas.removeEventListener('pointerdown', down); canvas.removeEventListener('contextmenu', menu);
      canvas.removeEventListener('lostpointercapture', end);
      window.removeEventListener('pointerup', end); window.removeEventListener('pointercancel', end);
      window.removeEventListener('blur', release.current); end(); s.hoverDisc = false;
    };
  }, [gl, camera, targets, invalidate]); // Picking reads the current matrices and mutable input state.
  useFrame(() => {
    if (heldId.current !== null && (!heroIsActive() || s.reduced || !s.holding)) release.current();
    s.hoverDisc = heroIsActive() && s.fine && s.inside && !s.link && hit(s.clientX, s.clientY);
  }, -1);
}
