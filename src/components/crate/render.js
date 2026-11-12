// Claude reference motion constants. t is LINEAR; easing lives here only.
export const cl = v => Math.max(0, Math.min(1, v));
export const eOut = x => 1 - (1 - x) ** 3;
export const eIO = x => x < .5 ? 4*x*x*x : 1 - (-2*x+2) ** 3 / 2;
export const backOut = x => 1 + 2.6*(x-1)**3 + 1.6*(x-1)**2;
// 클릭 즉시 예고 동작 (다음 페이지를 불러오는 동안)
//  - 앞으로(fwd): 아래 renderCrate 의 t 0 → LIFT_T 구간 그대로 = 지금 페이지가 살짝 들림. 페이지가 오면 그 t 에서 이어 감
//  - 뒤로(back): 지금 페이지가 PUSH_Z 만큼 살짝 뒤로 물러남. 전환이 시작되면 처음 30% 동안 원래 궤적으로 녹아듦
export const LIFT_T = .1;
export const LIFT_MS = 260;
export const PUSH_Z = -40;
export function liftPose(t) { const ant = eOut(cl(t/.14)); return `translate3d(0,${-1.4*ant}%,0) rotateX(${3.2*ant}deg)`; }
export function measurePage(el) {
  return { el, shade: el.querySelector(':scope > .ct-shade'), cast: el.querySelector(':scope > .ct-cast'),
    spec: el.querySelector(':scope > .ct-spec'), rv: [...el.querySelectorAll('.ct-reveal')] };
}
export function cleanPage(p) {
  if (!p) return;
  ['transform','opacity','zIndex'].forEach(k => p.el.style[k] = '');
  p.el.inert = false;
  [p.shade,p.cast,p.spec].forEach(el => { el.style.opacity = '0'; el.style.transform = ''; });
  p.rv.forEach(el => { el.style.opacity = ''; el.style.transform = ''; });
}
export function prepareCrate({front, back}) {
  front.el.style.zIndex = '3'; back.el.style.zIndex = '2';
  front.el.inert = back.el.inert = true;
  front.cast.style.opacity='0';front.spec.style.opacity='0';
  front.rv.forEach(el=>{el.style.opacity='';el.style.transform='';});
}
export function renderCrate(t, { front, back, sleeves, reduced, push = 0 }) {
  if (reduced) {
    front.el.style.opacity = String(1-t); back.el.style.opacity = '1';
    [front,back].forEach(p => { p.el.style.transform = 'none'; [p.cast,p.spec,p.shade].forEach(el => el.style.opacity = '0'); p.rv.forEach(el => {el.style.opacity='';el.style.transform='';}); });
    sleeves.forEach(el => el.style.opacity = '0');
  } else {
    const ant=eOut(cl(t/.14)), fall=cl((t-.10)/.78), fe=fall**2.4, hold=1-fall;
    front.el.style.transform=`translate3d(0,${-1.4*ant*hold+72*fe**1.15}%,0) rotateX(${3.2*ant*hold-74*fe}deg)`;
    front.el.style.opacity=String(1-cl((fe-.5)/.45));
    front.shade.style.opacity=String(.55*Math.min(1,fe*1.4));
    const rise=cl((t-.16)/.84),ro=eOut(rise);
    const pushed=push*(1-eOut(cl((1-t)/.3)));
    back.el.style.opacity='1';back.el.style.transform=`translate3d(0,0,${-260*(1-eIO(rise))+pushed}px) rotateX(${13*(1-backOut(rise))}deg)`;
    back.shade.style.opacity=String(.62*(1-ro));back.cast.style.opacity=String(Math.sin(Math.PI*fall)*.85);
    back.spec.style.opacity=String(Math.sin(Math.PI*rise)*.7);back.spec.style.transform=`translateY(${-100+330*eIO(rise)}%)`;
    back.rv.forEach((el,k)=>{const l=eOut(cl((rise-.40-k*.045)/.36));el.style.opacity=String(l);el.style.transform=`translateY(${(1-l)*18}px)`;});
    const s=Math.sin(Math.PI*cl(t));sleeves.forEach((el,i)=>{el.style.opacity=String(s*(.9-i*.24));el.style.transform=`translate3d(0,${-(i+1)*15*s}px,${-320-i*70}px) rotateX(${8+i*4}deg)`;});
  }
}
