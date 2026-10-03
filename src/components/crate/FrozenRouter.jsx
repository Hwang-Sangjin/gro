'use client';
// Next internal API: tested/pinned to 16.3.8. Recheck on upgrades.
import { LayoutRouterContext } from 'next/dist/shared/lib/app-router-context.shared-runtime';
export { LayoutRouterContext };
export default function FrozenRouter({ value, children }) {
  return <LayoutRouterContext.Provider value={value}>{children}</LayoutRouterContext.Provider>;
}
