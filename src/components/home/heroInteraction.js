// High-frequency data is shared without React renders. Inputs and InkVinyl write;
// camera, halo and DOM cursor read. One Hero is mounted at a time.
export const HERO_MOTION = {
  rpm: 10, startDelay: 1.2, spinEase: 4,
  yaw: 6, pitch: 2.5, damping: 3, typo: 14,
  accel: 1.5, maxRpm: 45, inertia: 1.4, fxIdle: 0.07, fxStrength: 1,
};
export const heroInteraction = {
  x: 0, y: 0, clientX: 0, clientY: 0,
  fine: false, reduced: false, visible: true, focused: true,
  ready: false, blocked: false, inside: false, pointerSeen: false,
  hoverDisc: false, holding: false, link: false,
  omega: 0, angle: 0,
};
export const heroIsActive = () => {
  const s = heroInteraction;
  return s.ready && s.visible && s.focused && !s.blocked;
};
