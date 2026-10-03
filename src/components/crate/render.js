// Claude reference motion constants. t is LINEAR; easing lives here only.
// renderCrate는 매 프레임 호출된다: 여기서는 transform/opacity만 쓰고, DOM을 읽거나 속성(inert 등)을 바꾸지 않는다.
export const cl = v => Math.max(0, Math.min(1, v));
export const eOut = x => 1 - (1 - x) ** 3;
export const eIO = x => x < .5 ? 4*x*x*x : 1 - (-2*x+2) ** 3 / 2;
export const backOut = x => 1 + 2.6*(x-1)**3 + 1.6*(x-1)**2;

export function measurePage(el) {
  return { el, shade: el.querySelector(':scope > .ct-shade'), cast: el.querySelector(':scope > .ct-cast'),
    spec: el.querySelector(':scope > .ct-spec'), rv: [...el.querySelectorAll('.ct-reveal')] };
}

// 전환 시작 시 1회: 입력 잠금 + 해당 요소에만 레이어 승격 (문서 전체 스타일 재계산을 피한다)
export function preparePages(pages, sleeves) {
  pages.forEach(p => { p.el.inert = true; p.el.style.willChange = 'transform, opacity'; });
  sleeves.forEach(el => { el.style.willChange = 'transform, opacity'; });
}

export function cleanPage(p) {
  if (!p) return;
  ['transform','opacity','zIndex','willChange','visibility'].forEach(k => p.el.style[k] = '');
  p.el.inert = false;
  [p.shade,p.cast,p.spec].forEach(el => { if (el) { el.style.opacity = '0'; el.style.transform = ''; } });
  p.rv.forEach(el => { el.style.opacity = ''; el.style.transform = ''; });
}

export function cleanSleeves(sleeves) {
  sleeves.forEach(el => { if (el) { el.style.opacity = '0'; el.style.transform = ''; el.style.willChange = ''; } });
}

export function renderCrate(t, { front, back, sleeves, reduced, from, to, dir, indicator }) {
  front.el.style.zIndex = '3'; back.el.style.zIndex = '2';
  if (reduced) {
    front.el.style.opacity = String(1-t); back.el.style.opacity = '1';
    [front,back].forEach(p => { p.el.style.transform = 'none'; [p.cast,p.spec,p.shade].forEach(el => el.style.opacity = '0'); p.rv.forEach(el => {el.style.opacity='';el.style.transform='';}); });
    sleeves.forEach(el => el.style.opacity = '0');
  } else {
    const ant=eOut(cl(t/.14)), fall=cl((t-.10)/.78), fe=fall**2.4, hold=1-fall;
    front.el.style.transform=`translate3d(0,${-1.4*ant*hold+72*fe**1.15}%,0) rotateX(${3.2*ant*hold-74*fe}deg)`;
    front.el.style.opacity=String(1-cl((fe-.5)/.45));
    front.shade.style.opacity=String(.55*Math.min(1,fe*1.4));front.cast.style.opacity='0';front.spec.style.opacity='0';
    front.rv.forEach(el=>{el.style.opacity='';el.style.transform='';});
    const rise=cl((t-.16)/.84),ro=eOut(rise);
    back.el.style.opacity='1';back.el.style.transform=`translate3d(0,0,${-260*(1-eIO(rise))}px) rotateX(${13*(1-backOut(rise))}deg)`;
    back.shade.style.opacity=String(.62*(1-ro));back.cast.style.opacity=String(Math.sin(Math.PI*fall)*.85);
    back.spec.style.opacity=String(Math.sin(Math.PI*rise)*.7);back.spec.style.transform=`translate3d(0,${-100+330*eIO(rise)}%,0)`;
    back.rv.forEach((el,k)=>{const l=eOut(cl((rise-.40-k*.045)/.36));el.style.opacity=String(l);el.style.transform=`translate3d(0,${(1-l)*18}px,0)`;});
    const s=Math.sin(Math.PI*cl(t));sleeves.forEach((el,i)=>{el.style.opacity=String(s*(.9-i*.24));el.style.transform=`translate3d(0,${-(i+1)*15*s}px,${-320-i*70}px) rotateX(${8+i*4}deg)`;});
  }
  // 인디케이터는 캐시된 좌표로만 그린다 (Navbar.measure 참고)
  indicator?.(from,to,dir==='fwd'?t:1-t);
}
