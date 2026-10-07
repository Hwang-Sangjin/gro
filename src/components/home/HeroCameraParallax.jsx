'use client';
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { HERO_MOTION as config, heroInteraction as s, heroIsActive } from './heroInteraction';
export default function HeroCameraParallax({ titleRef }) {
  const current = useRef({ x: 0, y: 0, weight: 1 });
  useFrame(({ camera, invalidate }, delta) => {
    const dt = Math.min(delta, 0.05), v = current.current;
    const enabled = heroIsActive() && s.fine && !s.reduced;
    v.weight += ((s.holding ? 0.3 : 1) - v.weight) * (1 - Math.exp(-dt * 6));
    const x = enabled ? s.x * v.weight : 0, y = enabled ? s.y * v.weight : 0;
    const a = s.reduced ? 1 : 1 - Math.exp(-dt * config.damping);
    v.x += (x - v.x) * a; v.y += (y - v.y) * a;
    const yaw = v.x * config.yaw * Math.PI / 180;
    const pitch = -v.y * config.pitch * Math.PI / 180; // DOM coordinates: up is negative.
    camera.position.set(Math.sin(yaw) * Math.cos(pitch) * 10, Math.sin(pitch) * 10, Math.cos(yaw) * Math.cos(pitch) * 10);
    camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
    if (titleRef.current) titleRef.current.style.transform = `translate3d(${-v.x * config.typo}px,${-v.y * config.typo * 0.5}px,0)`;
    if (Math.abs(v.x - x) + Math.abs(v.y - y) > 0.0001) invalidate();
  }, -2); // Move camera before picking and the verified light calculations.
  return null;
}
