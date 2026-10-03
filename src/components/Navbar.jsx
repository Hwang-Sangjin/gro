'use client';
import Link from 'next/link';
import {useEffect,useRef} from 'react';
import {useIntro} from './intro/intro-context';
import {useCrate} from './crate/CrateProvider';
import {NAV} from './crate/routes';
import {eIO} from './crate/render';
import DoodleSprite from './doodle/DoodleSprite';

const transitioning=()=>document.documentElement.dataset.crateTransition==='true';

/**
 * 페이지마다 하나씩 렌더되는 헤더. CratePage 안에 있으므로 페이지와 함께 플립된다.
 * path: 이 헤더가 속한 페이지의 경로 (usePathname을 쓰면 떠나는 페이지 헤더가 새 경로로 바뀌어 버린다)
 * pageKey: CrateStage가 인디케이터를 찾을 때 쓰는 페이지 key
 */
export default function Navbar({path,pageKey}){
  const {done}=useIntro(),{indicators,sound,toggleSound}=useCrate();
  const nav=useRef(null),line=useRef(null),buttons=useRef(new Map()),header=useRef(null);
  const geo=useRef(new Map()),active=useRef(undefined),pathRef=useRef(path);
  pathRef.current=path;

  useEffect(()=>{
    // offsetLeft/offsetWidth는 트랜스폼 영향을 받지 않는다. 기울어진 페이지 안에서도 정확하게 잴 수 있다.
    const measure=()=>{
      const next=new Map();
      buttons.current.forEach((el,key)=>next.set(key,{l:el.offsetLeft,w:el.offsetWidth}));
      geo.current=next;
    };
    const setActive=key=>{
      if(active.current===key)return;active.current=key;
      buttons.current.forEach((el,k)=>{el.style.opacity=k===key?'1':'.55';});
    };
    // 프레임마다 호출된다: 읽지 않고 transform·opacity만 쓴다.
    const paint=(from,to,p)=>{
      const el=line.current;if(!el)return;
      const A=geo.current.get(from)||geo.current.get(to),B=geo.current.get(to)||A;
      if(!A){el.style.opacity='0';setActive(null);return;}
      const e=eIO(p);
      el.style.opacity='1';
      el.style.transform=`translate3d(${A.l+(B.l-A.l)*e}px,0,0) scaleX(${A.w+(B.w-A.w)*e})`;
      setActive(p<.5?from:to);
    };
    paint.measure=measure;
    const registry=indicators.current;
    registry.set(pageKey,paint);

    const fit=()=>{measure();if(!transitioning())paint(pathRef.current,pathRef.current,1);};
    const obs=new ResizeObserver(fit);obs.observe(nav.current);
    let alive=true;document.fonts?.ready.then(()=>alive&&fit());fit();
    return()=>{alive=false;obs.disconnect();if(registry.get(pageKey)===paint)registry.delete(pageKey);};
  },[indicators,pageKey]);

  // 전환 밖에서 같은 페이지의 경로가 바뀌는 경우(검색 조건 등)만 스냅. 전환 중에는 CrateStage가 그린다.
  useEffect(()=>{if(!transitioning())indicators.current.get(pageKey)?.(path,path,1);},[path,pageKey,indicators]);

  return <nav ref={header} className="navbar ct-navbar" data-ready={done?'true':'false'} aria-label="주 메뉴">
    <Link className="navbar-mark" href="/">Grooves</Link>
    <div className="ct-nav-menu" ref={nav}>
      {NAV.map(item=><Link key={item.href} ref={el=>{if(el)buttons.current.set(item.href,el);else buttons.current.delete(item.href);}} href={item.href} aria-label={item.label} aria-current={path===item.href?'page':undefined} className="ct-nav-link"><DoodleSprite id={item.doodle}/><span>{item.label}</span></Link>)}
      <i ref={line} className="ct-indicator" aria-hidden="true"/>
    </div>
    <div className="ct-nav-actions"><Link href="/login">Login</Link><button type="button" onClick={toggleSound} aria-pressed={sound} aria-label="페이지 전환 효과음">{sound?'Sound on':'Sound off'}</button></div>
  </nav>;
}
