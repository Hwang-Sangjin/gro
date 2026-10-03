'use client';
import { forwardRef, useMemo } from 'react';
import FrozenRouter from './FrozenRouter';
import { CratePageContext } from './pageContext';
import Navbar from '../Navbar';

// 헤더는 페이지의 일부다: 스크롤 영역(.ct-content) 바깥 상단에 두어 페이지와 함께 플립되고, 본문 스크롤에는 따라가지 않는다.
const CratePage = forwardRef(function CratePage({ entry, leaving = false }, ref) {
  const page = useMemo(() => ({ leaving }), [leaving]);
  return <section ref={ref} className="ct-page" data-crate-path={entry.path}>
    <Navbar path={entry.path} pageKey={entry.key} />
    <div className="ct-content" data-lenis-prevent>
      <CratePageContext.Provider value={page}>
        <FrozenRouter value={entry.context}>{entry.node}</FrozenRouter>
      </CratePageContext.Provider>
    </div>
    <div className="ct-cast" aria-hidden="true" />
    <div className="ct-spec" aria-hidden="true" />
    <div className="ct-shade" aria-hidden="true" />
  </section>;
});
export default CratePage;
