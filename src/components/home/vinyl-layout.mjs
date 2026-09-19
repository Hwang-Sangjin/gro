export const SLEEVE = 3.2;
export const STEP_X = 1.6;
export const STEP_Y = .53;
export const STEP_Z = -.75;
export const TILT_X = .5;
export const TILT_Y = -.5;
export const AXIS_X = STEP_X / Math.hypot(STEP_X, STEP_Y);
export const AXIS_Y = -STEP_Y / Math.hypot(STEP_X, STEP_Y);
export const clamp = (value, max) => Math.min(Math.max(0, max), Math.max(0, value));
export const dragTarget = (start, distance, pixelsPerItem, max) =>
  Math.min(max + .25, Math.max(-.25, start - distance / pixelsPerItem));
export const releaseTarget = (target, velocity, elapsed, pixelsPerItem, max, cancelled = false) =>
  clamp(Math.round(target - (cancelled || elapsed > 90 ? 0 : velocity * 120 / pixelsPerItem)), max);
