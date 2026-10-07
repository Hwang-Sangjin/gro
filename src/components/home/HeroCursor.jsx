'use client';
import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useState } from 'react';
import { heroInteraction as s, heroIsActive } from './heroInteraction';

export default function HeroCursor() {
  const [mounted, setMounted] = useState(false);
  const ring = useRef(null), inner = useRef(null), dot = useRef(null), label = useRef(null), ticks = useRef(null);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!mounted) return;
    let raf = 0, previous = performance.now(), x = 0, y = 0, shown = false;
    const frame = now => {
      const dt = Math.min((now - previous) / 1000, 0.05); previous = now;
      const visible = heroIsActive() && s.fine && s.inside && s.pointerSeen;
      const mode = !visible ? 'hidden' : s.holding ? 'drag' : s.link ? 'link' : s.hoverDisc && !s.reduced ? 'disc' : 'idle';
      if (!shown || s.reduced) { x = s.clientX; y = s.clientY; }
      else { const a = 1 - Math.exp(-dt / 0.12); x += (s.clientX - x) * a; y += (s.clientY - y) * a; }
      shown = visible;
      document.documentElement.classList.toggle('custom-cursor', visible);
      ring.current.style.opacity = visible ? '1' : '0';
      ring.current.dataset.mode = mode;
      ring.current.style.transform = `translate3d(${x}px,${y}px,0)`;
      dot.current.style.transform = `translate3d(${s.clientX}px,${s.clientY}px,0)`;
      dot.current.style.opacity = mode === 'idle' ? '1' : '0';
      const rpm = Math.abs(s.omega) * 60 / (Math.PI * 2);
      const scale = mode === 'drag' ? 0.78 - Math.min(1, rpm / 45) * 0.14 : mode === 'disc' ? 1 : mode === 'link' ? 0.55 : 0.32;
      inner.current.style.transform = `scale(${scale})`;
      inner.current.style.background = mode === 'disc' || mode === 'drag' ? 'rgb(243 231 205 / .72)' : 'transparent';
      inner.current.style.backdropFilter = mode === 'disc' || mode === 'drag' ? 'blur(6px)' : 'none';
      inner.current.style.borderColor = mode === 'link' ? '#4c404a' : '#4f6d93';
      label.current.textContent = mode === 'drag' ? `${rpm.toFixed(0)} RPM` : mode === 'disc' ? 'HOLD' : '';
      ticks.current.style.opacity = mode === 'drag' ? '1' : '0';
      ticks.current.style.transform = `rotate(${-s.angle}rad)`;
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); document.documentElement.classList.remove('custom-cursor'); };
  }, [mounted]);
  if (!mounted) return null;
  return createPortal(<div aria-hidden="true" className="pointer-events-none fixed inset-0 z-[9999]">
    <div ref={ring} data-hero-cursor className="absolute left-0 top-0 opacity-0 transition-opacity duration-150">
      <div className="absolute -left-11 -top-11 h-[88px] w-[88px]">
        <div ref={inner} className="relative grid h-full w-full place-items-center rounded-full border text-[#4c404a] transition-[transform,background-color,border-color] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]" style={{ transform: 'scale(.32)' }}>
          <span ref={label} className="text-[13px] font-medium tracking-[0.12em]" />
          <div ref={ticks} className="absolute inset-[5px] rounded-full border border-dashed border-[#4f6d93] opacity-0">
            <i className="absolute -top-1 left-1/2 h-2 w-px bg-[#4f6d93]" />
            <i className="absolute -bottom-1 left-1/2 h-2 w-px bg-[#4f6d93]" />
          </div>
        </div>
      </div>
    </div>
    <div ref={dot} className="absolute left-0 top-0 opacity-0"><div className="-ml-[2px] -mt-[2px] h-1 w-1 rounded-full bg-[#4f6d93] ring-1 ring-[#f3e7cd]" /></div>
  </div>, document.body);
}
