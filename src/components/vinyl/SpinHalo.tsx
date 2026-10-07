'use client';
import { useEffect, useMemo, useRef, type RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { haloVert, haloFrag, LANES } from './haloShaders';
import { HERO_MOTION as config, heroInteraction as s, heroIsActive } from '../home/heroInteraction';
export function SpinHalo({ inkUniform, compRef }: { inkUniform: THREE.IUniform<THREE.Vector3>, compRef: RefObject<THREE.Group | null> }) {
  const level = useRef(0);
  const uniforms = useMemo(() => ({
    uInk: inkUniform, uFx: { value: 0 }, uDir: { value: -1 },
    uLane: { value: Array(LANES).fill(0) }, uRipple: { value: 0 }, uTime: { value: 0 },
  }), [inkUniform]);
  const [geometry, material] = useMemo(() => [
    new THREE.PlaneGeometry(4.2, 4.2).rotateX(-Math.PI / 2),
    new THREE.ShaderMaterial({ vertexShader: haloVert, fragmentShader: haloFrag, uniforms,
      transparent: true, premultipliedAlpha: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }),
  ], [uniforms]);
  useEffect(() => () => { geometry.dispose(); material.dispose(); }, [geometry, material]);
  useFrame((_, delta) => {
    if (!heroIsActive() || s.reduced) { level.current = 0; uniforms.uFx.value = 0; return; }
    const comp = compRef.current;
    if (!comp) return;
    comp.updateWorldMatrix(true, false);
    if (Math.abs(comp.matrixWorld.determinant()) < 1e-10) return;
    const dt = Math.min(delta, 0.05), rpm = Math.abs(s.omega) * 60 / (Math.PI * 2);
    const norm = THREE.MathUtils.clamp((rpm - config.rpm) / (config.maxRpm - config.rpm), 0, 1);
    const target = Math.max(norm, config.fxIdle * Math.min(1, rpm / config.rpm));
    level.current += (target - level.current) * (1 - Math.exp(-dt / (target > level.current ? 0.12 : 0.7)));
    uniforms.uFx.value = Math.min(1, Math.pow(level.current, 0.8) * config.fxStrength);
    if (Math.abs(s.omega) > 0.05) uniforms.uDir.value = Math.sign(s.omega);
    for (let i = 0; i < LANES; i++) uniforms.uLane.value[i] = (uniforms.uLane.value[i] - s.omega * (1 - i * 0.11) * dt) % (Math.PI * 2);
    uniforms.uRipple.value += dt * (0.25 + 3.2 * uniforms.uFx.value);
    uniforms.uTime.value += dt;
  });
  return <mesh name="hero-spin-halo" geometry={geometry} material={material} position-y={-0.019} renderOrder={1} dispose={null} />;
}
