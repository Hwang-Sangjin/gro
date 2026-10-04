'use client';
import { forwardRef } from 'react';
import FrozenRouter from './FrozenRouter';
import Navbar from '../Navbar';
const CratePage = forwardRef(function CratePage({ entry }, ref) {
  return <section ref={ref} className="ct-page" data-crate-path={entry.path}>
    <Navbar path={entry.path} />
    <div className="ct-content" data-lenis-prevent>
      <FrozenRouter value={entry.context}>{entry.node}</FrozenRouter>
    </div>
    <div className="ct-cast" aria-hidden="true" />
    <div className="ct-spec" aria-hidden="true" />
    <div className="ct-shade" aria-hidden="true" />
  </section>;
});
export default CratePage;
