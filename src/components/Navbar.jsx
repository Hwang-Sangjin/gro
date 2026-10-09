'use client';
/* 사이트 헤더 — "레코드 레이블 마스트헤드"
   - 왼쪽: Bodoni 워드마크
   - 가운데: 01 Home · 02 Digging … 번호 붙은 메뉴. 호버하면 밑줄이 그어짐
   - 오른쪽: (재생 중일 때만) Now spinning · Login · Sound(이퀄라이저 아이콘)
   - 스크롤하면 아래 헤어라인 (높이는 고정: Digging 고정 바·Home 엔진이 헤더 높이에 맞춰져 있음). 모바일은 Menu → 전체 화면 메뉴
   페이지(.ct-page)마다 자기 헤더를 가짐. 색은 --ct-header-fg/bg(페이지가 정함)를 그대로 따름 */
import Link from 'next/link';
import {useEffect,useRef,useState} from 'react';
import {useIntro} from './intro/intro-context';
import {useCrate} from './crate/CrateProvider';
import {NAV} from './crate/routes';
import {useNowSpinning} from '@/lib/nowSpinning';

const BODONI={fontFamily:'"Grooves Bodoni", "Bodoni MT", Georgia, serif'};
const num=i=>String(i+1).padStart(2,'0');

// 작은 레코드 — 재생 중 표시. 홈 사이의 홈(notch)이 있어 도는 게 보임
function SpinningDisc({className=''}){
  return <svg viewBox="0 0 24 24" aria-hidden="true" className={`shrink-0 animate-[spin_1.8s_linear_infinite] motion-reduce:animate-none ${className}`}>
    <circle cx="12" cy="12" r="11" fill="currentColor"/>
    <circle cx="12" cy="12" r="8" fill="none" stroke="var(--ct-header-bg,#f4e7cd)" strokeOpacity=".35" strokeWidth=".6"/>
    <circle cx="12" cy="12" r="5.6" fill="none" stroke="var(--ct-header-bg,#f4e7cd)" strokeOpacity=".35" strokeWidth=".6"/>
    <circle cx="12" cy="12" r="3.4" fill="var(--ct-header-bg,#f4e7cd)" fillOpacity=".85"/>
    <path d="M12 1.5v4" stroke="var(--ct-header-bg,#f4e7cd)" strokeOpacity=".7" strokeWidth="1"/>
    <circle cx="12" cy="12" r=".9" fill="currentColor"/>
  </svg>;
}

// Sound 토글: 켜져 있으면 막대가 춤춤, 꺼져 있으면 납작하게 멈춤
function SoundButton({sound,onClick,className=''}){
  return <button type="button" onClick={onClick} aria-pressed={sound} aria-label="페이지 전환 효과음" title={sound?'Sound on':'Sound off'}
    className={`grid size-9 place-items-center rounded-full border border-current/25 transition-colors hover:border-current hover:bg-current/10 ${className}`}>
    <span aria-hidden="true" className="flex h-3.5 items-end gap-[2.5px]">
      {[0,1,2,3].map(i=><span key={i} className={`block h-full w-[2px] origin-bottom rounded-full bg-current transition-transform duration-300 ${sound?'animate-eq motion-reduce:animate-none':'scale-y-[.28]'}`}
        style={sound?{animationDelay:`${[-.2,-.55,-.1,-.4][i]}s`,animationDuration:`${[.8,1,.7,.9][i]}s`}:undefined}/>)}
    </span>
  </button>;
}

export default function Navbar({path}){
  const {done}=useIntro(),{sound,toggleSound}=useCrate();
  const spinning=useNowSpinning();
  const nav=useRef(null);
  const [scrolled,setScrolled]=useState(false);
  const [open,setOpen]=useState(false);

  // 이 페이지 레이어 안의 스크롤(.page)을 보고 헤더를 얇게
  useEffect(()=>{
    const layer=nav.current?.parentElement;
    if(!layer)return;
    const onScroll=e=>{const t=e.target;if(t instanceof HTMLElement)setScrolled(t.scrollTop>24);};
    layer.addEventListener('scroll',onScroll,{capture:true,passive:true});
    return()=>layer.removeEventListener('scroll',onScroll,{capture:true});
  },[]);
  // 모바일 메뉴: Esc로 닫기
  useEffect(()=>{
    if(!open)return;
    const onKey=e=>{if(e.key==='Escape')setOpen(false);};
    window.addEventListener('keydown',onKey);
    return()=>window.removeEventListener('keydown',onKey);
  },[open]);

  return <nav ref={nav} aria-label="주 메뉴" data-home={path==='/'?'true':'false'} data-ready={done?'true':'false'}
    className={`navbar ct-navbar inset-x-0 flex items-center justify-between gap-4 px-[clamp(16px,3.2vw,44px)] h-(--ct-header-h) transition-opacity duration-500 md:grid md:grid-cols-[1fr_auto_1fr]`}>
    {/* 스크롤 헤어라인 */}
    <span aria-hidden="true" className={`pointer-events-none absolute inset-x-0 bottom-0 h-px bg-current/15 transition-opacity duration-500 ${scrolled?'opacity-100':'opacity-0'}`}/>

    <Link href="/" className="justify-self-start text-[clamp(22px,2vw,28px)] font-black leading-none tracking-[-.035em]" style={BODONI}>Grooves</Link>

    <ul className="hidden items-center gap-[clamp(24px,3.2vw,56px)] md:flex">
      {NAV.map((item,i)=><li key={item.href}>
        <Link href={item.href} aria-current={path===item.href?'page':undefined}
          className="group relative flex items-baseline gap-2.5 py-2 text-[clamp(17px,1.65vw,24px)] font-medium uppercase tracking-[.14em] opacity-60 transition-opacity duration-300 hover:opacity-100 aria-[current=page]:opacity-100">
          <span className="text-[.5em] tabular-nums tracking-[.08em] opacity-55">{num(i)}</span>
          {item.label}
          <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-[1.5px] origin-left scale-x-0 bg-current transition-transform duration-500 ease-[cubic-bezier(.22,1,.36,1)] group-hover:scale-x-100 group-aria-[current=page]:scale-x-100"/>
        </Link>
      </li>)}
    </ul>

    <div className="flex items-center justify-self-end gap-[clamp(12px,1.6vw,22px)]">
      {spinning&&<Link href={`/album/${spinning.slug}`} title={`Now spinning — ${spinning.title}`}
        className="flex max-w-[clamp(36px,22vw,280px)] items-center gap-2.5 rounded-full border border-current/20 py-1.5 pl-1.5 pr-1.5 text-[12px] transition-[opacity,translate,border-color] duration-500 hover:border-current/50 starting:translate-y-1 starting:opacity-0 lg:pr-4">
        <SpinningDisc className="size-6"/>
        <span className="hidden min-w-0 flex-col leading-tight lg:flex">
          <span className="text-[9px] uppercase tracking-[.22em] opacity-60">Now spinning</span>
          <span className="truncate font-medium">{spinning.title}</span>
        </span>
        <span className="sr-only lg:hidden">Now spinning: {spinning.title}</span>
      </Link>}
      <Link href="/login" aria-current={path==='/login'?'page':undefined}
        className="group relative hidden py-1 text-[12px] font-medium uppercase tracking-[.2em] md:block">
        Login
        <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-px origin-right scale-x-0 bg-current transition-transform duration-500 group-hover:origin-left group-hover:scale-x-100"/>
      </Link>
      <SoundButton sound={sound} onClick={toggleSound} className="hidden md:grid"/>
      {/* 모바일: Menu */}
      <button type="button" onClick={()=>setOpen(true)} aria-expanded={open} aria-controls="site-menu"
        className="flex min-h-11 items-center gap-2.5 text-[12px] font-medium uppercase tracking-[.2em] md:hidden">
        Menu
        <span aria-hidden="true" className="flex w-5 flex-col gap-[5px]"><span className="h-px bg-current"/><span className="h-px w-3/5 self-end bg-current"/></span>
      </button>
    </div>

    {/* 모바일 전체 화면 메뉴 — 잉크색 슬리브가 위에서 내려옴 */}
    <div id="site-menu" role="dialog" aria-modal="true" aria-label="메뉴" inert={!open} data-open={open}
      className="fixed inset-0 z-40 flex flex-col bg-[#2a222a] px-6 pb-8 pt-6 text-[#f4e7cd] transition-[clip-path] duration-700 ease-[cubic-bezier(.76,0,.24,1)] [clip-path:inset(0_0_100%_0)] data-[open=true]:[clip-path:inset(0)] md:hidden">
      <div className="flex items-center justify-between">
        <Link href="/" onClick={()=>setOpen(false)} className="text-[24px] font-black leading-none tracking-[-.035em]" style={BODONI}>Grooves</Link>
        <button type="button" onClick={()=>setOpen(false)} className="flex min-h-11 items-center gap-2.5 text-[12px] font-medium uppercase tracking-[.2em]">
          Close<span aria-hidden="true" className="relative block size-4"><span className="absolute left-0 top-1/2 h-px w-full rotate-45 bg-current"/><span className="absolute left-0 top-1/2 h-px w-full -rotate-45 bg-current"/></span>
        </button>
      </div>
      <ul className="mt-auto flex flex-col">
        {NAV.map((item,i)=><li key={item.href} className="overflow-y-clip border-b border-[#f4e7cd]/15">
          <Link href={item.href} onClick={()=>setOpen(false)} aria-current={path===item.href?'page':undefined}
            className={`flex items-baseline gap-4 py-3 transition-transform duration-700 ease-[cubic-bezier(.22,1,.36,1)] ${open?'translate-y-0':'translate-y-full'}`}
            style={{transitionDelay:open?`${180+i*70}ms`:'0ms'}}>
            <span className="text-[11px] tabular-nums tracking-[.1em] opacity-50">{num(i)}</span>
            <span className="text-[clamp(44px,13vw,64px)] font-black leading-[1] tracking-[-.04em]" style={BODONI}>{item.label}</span>
            {path===item.href&&<span aria-hidden="true" className="ml-auto size-2 self-center rounded-full bg-current"/>}
          </Link>
        </li>)}
      </ul>
      {spinning&&<Link href={`/album/${spinning.slug}`} onClick={()=>setOpen(false)} className="mt-8 flex min-w-0 items-center gap-3 rounded-full border border-[#f4e7cd]/20 py-1.5 pl-1.5 pr-4 text-[13px]">
        <SpinningDisc className="size-7 [--ct-header-bg:#2a222a]"/>
        <span className="min-w-0 truncate"><span className="mr-2 text-[10px] uppercase tracking-[.2em] opacity-60">Now spinning</span>{spinning.title}</span>
      </Link>}
      <div className={`flex items-center justify-between ${spinning?'mt-5':'mt-8'}`}>
        <Link href="/login" onClick={()=>setOpen(false)} className="text-[12px] font-medium uppercase tracking-[.2em]">Login</Link>
        <SoundButton sound={sound} onClick={toggleSound}/>
      </div>
    </div>
  </nav>;
}
