'use client';
import { useContext, useLayoutEffect, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutRouterContext } from './FrozenRouter';
import CratePage from './CratePage';
import { useCrate } from './CrateProvider';
import { useIntro } from '../intro/intro-context';
import { cl, cleanPage, cleanSleeves, measurePage, preparePages, renderCrate } from './render';
import { NAV, rank, labelFor } from './routes';

// 프레임 하나가 진행시킬 수 있는 최대 시간. 평소 프레임 간격(이동 평균)의 2.5배, 최소 50ms.
// 마운트·GC 같은 일시적 끊김만 잘라내서 t가 건너뛰지 않게 하고, 꾸준히 느린 기기는 늦추지 않는다.
const SPIKE_RATIO = 2.5, MIN_CAP = 50;
// 착지 직후의 무거운 작업(이전 페이지 언마운트, crate:end 후속 작업)을 다음 유휴 시간으로 미룬다.
const defer = fn => (typeof window !== 'undefined' && window.requestIdleCallback)
  ? window.requestIdleCallback(fn, { timeout: 150 })
  : setTimeout(fn, 60);

export default function CrateStage({children}) {
  const pathname=usePathname(), context=useContext(LayoutRouterContext), router=useRouter(), {done}=useIntro();
  const {bridge,indicators,sfx,setBusy}=useCrate();
  const [entries,setEntries]=useState(()=>[{key:0,path:pathname,node:children,context}]);
  const [leavingKey,setLeavingKey]=useState(null);
  const [announcement,setAnnouncement]=useState('');
  const nodes=useRef(new Map()), stage=useRef(null), serial=useRef(0), sleeves=useRef([]);
  const current=useRef({path:pathname,href:pathname,key:0}), lastPath=useRef(pathname);
  const T=useRef(null), raf=useRef(0), pending=useRef(null), awaiting=useRef(null), timeout=useRef(null);
  const latest=useRef({done,pathname,children,context});latest.current={done,pathname,children,context};
  const drag=useRef(null), ignoreClick=useRef(false), cancelPath=useRef(null), functions=useRef({});

  function lock(value){setBusy(value);document.documentElement.dataset.crateTransition=String(value);window.dispatchEvent(new Event(value?'crate:start':'crate:end'));}
  function clearWaiting(){clearTimeout(timeout.current);awaiting.current=null;}
  function draw(){if(T.current)renderCrate(T.current.t,T.current);}
  function cleanAll(){for(const node of nodes.current.values())cleanPage(measurePage(node));cleanSleeves(sleeves.current);}
  function focusPage(key,path){requestAnimationFrame(()=>{const node=nodes.current.get(key),head=node?.querySelector('h1,h2');if(head){head.setAttribute('tabindex','-1');head.focus({preventScroll:true});}setAnnouncement(`${labelFor(path)} 페이지`);});}
  function flush(){const next=pending.current;pending.current=null;if(next)queueMicrotask(()=>functions.current.go(next));}

  function finish(success){
    const tr=T.current;if(!tr)return;cancelAnimationFrame(raf.current);
    T.current=null;drag.current=null;clearWaiting();
    const keep=success?tr.newEntry:tr.oldEntry, drop=success?tr.oldEntry:tr.newEntry;
    cleanAll();
    // 사라질 페이지는 즉시 숨기고, 실제 언마운트(R3F·GSAP 정리)는 착지 프레임이 지난 뒤에 한다.
    const dropEl=nodes.current.get(drop.key);if(dropEl){dropEl.style.visibility='hidden';dropEl.inert=true;}
    setLeavingKey(drop.key);
    current.current={path:keep.path,key:keep.key,href:success?location.pathname+location.search:tr.fromHref};
    indicators.current.get(keep.key)?.(keep.path,keep.path,1);
    const removeDrop=()=>{setEntries(old=>old.filter(e=>e.key!==drop.key));setLeavingKey(k=>k===drop.key?null:k);};
    if(success){
      focusPage(keep.key,keep.path);
      defer(()=>{removeDrop();lock(false);flush();});
    } else {
      cancelPath.current=tr.oldEntry.path;
      defer(removeDrop);
      router.replace(tr.fromHref,{scroll:false});
    }
  }

  function animate(tv,delayStart=false){
    const tr=T.current;if(!tr)return;cancelAnimationFrame(raf.current);
    const t0=tr.t,duration=tr.reduced?180:Math.max(260,1300*Math.abs(tv-t0));
    const success=(tr.dir==='fwd')===(tv===1);
    let elapsed=0,last=null,hit=false,avg=1000/60;
    const step=now=>{
      if(T.current!==tr)return;
      const raw=last==null?0:now-last;last=now;
      const dt=Math.min(raw,Math.max(MIN_CAP,avg*SPIKE_RATIO));
      if(raw)avg=avg*.8+Math.min(raw,100)*.2;
      elapsed+=dt;
      const u=cl(elapsed/duration);tr.t=t0+(tv-t0)*u;draw();
      if(success&&!hit&&(tr.dir==='fwd'?tr.t>.86:tr.t<.12)){hit=true;sfx.current?.play('thup');}
      if(u<1)raf.current=requestAnimationFrame(step);else finish(success);
    };
    // 자동 재생은 새 페이지 마운트 직후의 무거운 프레임을 2프레임 흘려보낸 뒤 시작한다.
    if(delayStart)raf.current=requestAnimationFrame(()=>{if(T.current===tr)raf.current=requestAnimationFrame(step);});
    else raf.current=requestAnimationFrame(step);
  }

  function go(href,manual=false){
    const url=new URL(href,location.href);if(url.origin!==location.origin)return;
    if(T.current||awaiting.current){if(!drag.current)pending.current=url.pathname+url.search+url.hash;return;}
    if(url.pathname===current.current.path){router.push(href,{scroll:false});return;}
    awaiting.current={href:url.pathname+url.search,manual,fromHref:location.pathname+location.search};
    lock(true);
    router.push(href,{scroll:false});
    timeout.current=setTimeout(()=>{if(!T.current){clearWaiting();drag.current=null;lock(false);flush();}},15000);
  }
  functions.current={go,animate,finish};
  bridge.current.go=go;

  useLayoutEffect(()=>{
    if(pathname===lastPath.current){
      // Same-path server refresh/search updates must stay live.
      if(!T.current&&!cancelPath.current)setEntries(old=>old.length===1&&old[0].node===children&&old[0].context===context?old:old.map(e=>e.path===pathname?{...e,node:children,context}:e));
      return;
    }
    lastPath.current=pathname;
    if(cancelPath.current===pathname){cancelPath.current=null;clearWaiting();lock(false);flush();return;}
    if(T.current){ // a browser back/forward supersedes an in-flight route
      cancelAnimationFrame(raf.current);cleanAll();const keep=T.current.newEntry;current.current={path:keep.path,key:keep.key,href:keep.path};T.current=null;
    }
    const next={key:++serial.current,path:pathname,node:children,context};
    if(!done){current.current={path:pathname,key:next.key,href:pathname};setEntries([next]);clearWaiting();lock(false);return;}
    setEntries(old=>[old.find(e=>e.key===current.current.key)||old.at(-1),next]);
  },[pathname,children,context,done]);

  useLayoutEffect(()=>{
    if(entries.length!==2||T.current)return;
    const [oldEntry,newEntry]=entries,oldEl=nodes.current.get(oldEntry.key),newEl=nodes.current.get(newEntry.key);if(!oldEl||!newEl)return;
    const dir=rank(newEntry.path)>=rank(oldEntry.path)?'fwd':'back';
    const req=awaiting.current,manual=!!req?.manual;
    clearTimeout(timeout.current);
    T.current={oldEntry,newEntry,fromHref:req?.fromHref||current.current.href,from:oldEntry.path,to:newEntry.path,dir,
      t:manual&&drag.current?drag.current.t:(dir==='fwd'?0:1),
      front:measurePage(dir==='fwd'?oldEl:newEl),back:measurePage(dir==='fwd'?newEl:oldEl),
      sleeves:sleeves.current.filter(Boolean),reduced:matchMedia('(prefers-reduced-motion: reduce)').matches,
      // 인디케이터는 들어오는 페이지의 헤더에 그린다 (이전 메뉴 위치 → 새 메뉴 위치)
      indicator:(...args)=>indicators.current.get(newEntry.key)?.(...args),manual};
    // 전환당 1회: 입력 잠금, 레이어 승격, 인디케이터 좌표 측정. 프레임 루프 안에서는 DOM을 읽지 않는다.
    preparePages([T.current.front,T.current.back],T.current.sleeves);
    indicators.current.get(newEntry.key)?.measure?.();
    setLeavingKey(oldEntry.key);
    lock(true);draw();sfx.current?.play('slide');
    if(!manual)animate(dir==='fwd'?1:0,true);else if(drag.current?.release!=null)animate(drag.current.release);
  },[entries]);

  useEffect(()=>{
    const click=e=>{
      if(ignoreClick.current){e.preventDefault();e.stopPropagation();return;}
      const a=e.target.closest?.('a[href]');if(!a||e.defaultPrevented||e.button!==0||e.metaKey||e.ctrlKey||e.altKey||e.shiftKey||a.download||a.target&&a.target!=='_self'||a.hasAttribute('data-crate-skip'))return;
      const u=new URL(a.href,location.href);if(u.origin!==location.origin||u.pathname===location.pathname)return;
      e.preventDefault();e.stopPropagation();functions.current.go(u.pathname+u.search+u.hash);
    };
    const key=e=>{
      if(!latest.current.done||e.defaultPrevented||e.metaKey||e.ctrlKey||e.altKey||e.shiftKey||e.target.closest?.('input,textarea,select,[contenteditable=true],[role=slider],video,iframe,[role=dialog]'))return;
      // Native page scrolling is reserved; page-navigation keys only on the drag handle or nav.
      if(!e.target.closest?.('[data-crate-handle],.navbar'))return;
      const index=NAV.findIndex(p=>p.href===current.current.path),delta=['ArrowDown','ArrowRight','PageDown'].includes(e.key)?1:['ArrowUp','ArrowLeft','PageUp'].includes(e.key)?-1:0;
      if(delta&&NAV[index+delta]){e.preventDefault();functions.current.go(NAV[index+delta].href);}
    };
    document.addEventListener('click',click,true);document.addEventListener('keydown',key);
    return()=>{document.removeEventListener('click',click,true);document.removeEventListener('keydown',key);};
  },[]);
  useEffect(()=>()=>{cancelAnimationFrame(raf.current);clearTimeout(timeout.current);delete document.documentElement.dataset.crateTransition;bridge.current={};},[]);

  function down(e){
    if(!done||T.current||awaiting.current||e.button!==0)return;
    const handle=e.target.closest('[data-crate-handle]');
    if(!handle&&(e.pointerType==='touch'||e.target.closest('a,button,input,textarea,select,canvas,video,[role=dialog]')))return;
    drag.current={id:e.pointerId,armed:true,on:false,y:e.clientY,lastY:e.clientY,lastTime:performance.now(),v:0,handle:!!handle,release:null};
  }
  function move(e){
    const d=drag.current;if(!d||d.id!==e.pointerId||!d.armed)return;
    const dy=e.clientY-d.y,now=performance.now();
    if(!d.on){
      if(Math.abs(dy)<10)return;
      const page=nodes.current.get(current.current.key)?.querySelector('.page');
      if(!d.handle&&page&&(dy<0?page.scrollTop>2:page.scrollTop+page.clientHeight<page.scrollHeight-2)){drag.current=null;return;}
      const index=NAV.findIndex(p=>p.href===current.current.path),to=NAV[index+(dy>0?1:-1)];
      if(index<0||!to){drag.current=null;return;}
      d.on=true;d.dir=dy>0?'fwd':'back';d.t=d.dir==='fwd'?0:1;d.to=to.href;
      stage.current.setPointerCapture(e.pointerId);go(to.href,true);
    }
    e.preventDefault();const H=stage.current.clientHeight*.6;d.t=d.dir==='fwd'?cl(dy/H):1-cl(-dy/H);
    if(T.current){T.current.t=d.t;draw();}
    d.v=.7*d.v+.3*(e.clientY-d.lastY)/Math.max(1,now-d.lastTime);d.lastY=e.clientY;d.lastTime=now;
  }
  function release(e){
    const d=drag.current;if(!d||d.id!==e.pointerId)return;
    if(!d.on){drag.current=null;return;}
    const v=performance.now()-d.lastTime>100?0:d.v;
    d.armed=false;d.release=e.type==='pointercancel'?(d.dir==='fwd'?0:1):d.dir==='fwd'?(d.t>.3||v>.55?1:0):(d.t<.7||v<-.55?0:1);
    ignoreClick.current=true;setTimeout(()=>ignoreClick.current=false,0);
    if(T.current)animate(d.release);
  }
  return <>
    <main ref={stage} className="ct-stage" data-crate-stage onPointerDown={down} onPointerMove={move} onPointerUp={release} onPointerCancel={release}>
      {[0,1,2].map(i=><div key={i} ref={el=>sleeves.current[i]=el} className="ct-sleeve" aria-hidden="true" />)}
      {entries.map(entry=><CratePage key={entry.key} entry={entry} leaving={entry.key===leavingKey} ref={el=>{if(el)nodes.current.set(entry.key,el);else nodes.current.delete(entry.key);}} />)}
      {done&&<button type="button" data-crate-handle className="ct-handle" aria-label="페이지 넘기기: 아래로 끌면 다음, 위로 끌면 이전. 방향키 사용 가능.">↕ <span>Flip the crate</span></button>}
    </main>
    <p className="sr-only" aria-live="polite" aria-atomic="true">{announcement}</p>
  </>;
}
