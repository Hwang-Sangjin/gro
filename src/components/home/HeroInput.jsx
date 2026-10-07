'use client';
import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import { heroInteraction as s } from './heroInteraction';

export default function HeroInput({ sectionRef, active }) {
  const { gl, invalidate } = useThree();
  useEffect(() => { s.ready = active; invalidate(); }, [active, invalidate]);
  useEffect(() => {
    const canvas = gl.domElement;
    const previousTouchAction = canvas.style.touchAction;
    canvas.style.touchAction = 'pan-y';
    const fine = matchMedia('(hover: hover) and (pointer: fine)');
    const reduce = matchMedia('(prefers-reduced-motion: reduce)');
    const reset = () => {
      s.x = s.y = 0; s.holding = s.hoverDisc = s.inside = false;
      s.pointerSeen = false; invalidate();
    };
    const media = () => { s.fine = fine.matches; s.reduced = reduce.matches; reset(); };
    const move = e => {
      if (e.pointerType === 'touch') return;
      const box = canvas.getBoundingClientRect();
      s.clientX = e.clientX; s.clientY = e.clientY; s.pointerSeen = true;
      s.inside = e.clientX >= box.left && e.clientX <= box.right && e.clientY >= box.top && e.clientY <= box.bottom;
      s.x = s.inside ? Math.max(-1, Math.min(1, ((e.clientX - box.left) / box.width) * 2 - 1)) : 0;
      s.y = s.inside ? Math.max(-1, Math.min(1, ((e.clientY - box.top) / box.height) * 2 - 1)) : 0;
      s.link = !!e.target?.closest?.('a,button,summary,[role="button"]');
      if (!s.inside) s.hoverDisc = false;
      invalidate();
    };
    const blur = () => { s.focused = false; reset(); };
    const focus = () => { s.focused = !document.hidden; invalidate(); };
    const visibility = () => document.hidden ? blur() : focus();
    const leave = e => { if (!e.relatedTarget) reset(); };
    const start = () => { s.blocked = true; reset(); };
    const end = () => { s.blocked = false; invalidate(); };
    const observer = new IntersectionObserver(([entry]) => {
      s.visible = entry.isIntersecting && entry.intersectionRatio > 0.1;
      if (!s.visible) reset();
      invalidate();
    }, { threshold: [0, 0.1] });
    if (sectionRef.current) observer.observe(sectionRef.current);
    s.focused = !document.hidden; s.blocked = false; media();
    fine.addEventListener('change', media); reduce.addEventListener('change', media);
    window.addEventListener('pointermove', move, { passive: true });
    window.addEventListener('pointerout', leave);
    window.addEventListener('blur', blur); window.addEventListener('focus', focus);
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('crate:start', start); window.addEventListener('crate:end', end);
    return () => {
      canvas.style.touchAction = previousTouchAction;
      observer.disconnect(); reset(); s.ready = false; s.omega = s.angle = 0;
      fine.removeEventListener('change', media); reduce.removeEventListener('change', media);
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerout', leave);
      window.removeEventListener('blur', blur); window.removeEventListener('focus', focus);
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('crate:start', start); window.removeEventListener('crate:end', end);
    };
  }, [gl, invalidate, sectionRef]);
  return null;
}
