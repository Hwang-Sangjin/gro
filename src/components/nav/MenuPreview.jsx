'use client';
// 헤더 펼침 패널 속 작은 그림 — Dig: 최근 등록된 커버 3장 / My Shelf: 내 판 3장 / LEGO: 커버를 브릭으로 / Map: 선 지도와 핀
import {useEffect,useRef,useState} from 'react';
import {authClient} from '@/lib/useAuthUser';
import {coverUrl} from '@/lib/albums';

const COLS='slug, title, thumb_path, cover_color';
let cache=null;   // 페이지마다 헤더가 따로 있어도 한 번만 불러옴
function load(signedIn){
  if(cache&&cache.signedIn===signedIn)return cache.p;
  const sb=authClient();
  const p=Promise.all([
    sb.from('albums').select(COLS,{count:'exact'}).eq('status','published').order('created_at',{ascending:false}).limit(3),
    signedIn?sb.from('user_albums').select(`albums!inner(${COLS}, status)`,{count:'exact'}).eq('kind','owned').eq('albums.status','published').order('created_at',{ascending:false}).limit(3):null,
  ]).then(([dig,shelf])=>({
    dig:{items:dig.data??[],count:dig.count??null},
    shelf:shelf?{items:(shelf.data??[]).map(r=>r.albums),count:shelf.count??null}:null,
  }),()=>({dig:{items:[],count:null},shelf:null}));
  cache={signedIn,p};
  return p;
}
export function useMenuPreview(active,signedIn){
  const [data,setData]=useState(null);
  useEffect(()=>{
    if(!active||signedIn===undefined)return;
    let off=false;
    load(!!signedIn).then(d=>{if(!off)setData(d);});
    return()=>{off=true;};
  },[active,signedIn]);
  return data;
}

// 겹친 커버 3장 (없으면 빈 슬리브)
function Stack({items}){
  return <span className="relative block h-full w-full">
    {[0,1,2].map(i=>{
      const a=items?.[i];
      return <span key={i} className="absolute top-1/2 aspect-square h-[78%] -translate-y-1/2 overflow-hidden rounded-[2px] bg-current/10 shadow-[0_10px_18px_-10px_rgba(0,0,0,.55)] transition-transform duration-700 ease-[cubic-bezier(.22,1,.36,1)] group-hover/item:-translate-y-[58%]"
        style={{left:`${i*22}%`,zIndex:3-i,rotate:`${(i-1)*5}deg`,transitionDelay:`${i*40}ms`,background:a?.cover_color||undefined}}>
        {a?.thumb_path&&<img src={coverUrl(a.thumb_path)} alt="" loading="lazy" decoding="async" draggable={false} className="size-full select-none object-cover"/>}
      </span>;
    })}
  </span>;
}

// 커버 한 장을 14×14 브릭으로 (캔버스에 작게 그려 크게 늘림 + 스터드 무늬)
function Lego({album}){
  const ref=useRef(null);
  useEffect(()=>{
    const c=ref.current;if(!c||!album?.thumb_path)return;
    const img=new Image();
    img.onload=()=>{const g=c.getContext('2d');g.imageSmoothingEnabled=true;g.drawImage(img,0,0,14,14);};
    img.src=coverUrl(album.thumb_path);
  },[album?.thumb_path]);
  return <span className="relative block aspect-square h-[78%] overflow-hidden rounded-[2px] shadow-[0_10px_18px_-10px_rgba(0,0,0,.55)]" style={{background:album?.cover_color||'#c9a27a'}}>
    <canvas ref={ref} width="14" height="14" className="size-full [image-rendering:pixelated]"/>
    <span aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,rgba(255,255,255,.32)_0_26%,rgba(0,0,0,.18)_30%_34%,transparent_36%)] bg-[length:calc(100%/14)_calc(100%/14)]"/>
  </span>;
}

// 가는 선 지도 + 핀
function MapArt(){
  return <svg viewBox="0 0 120 80" className="h-[78%] w-auto" aria-hidden="true">
    <rect x=".5" y=".5" width="119" height="79" rx="2" fill="none" stroke="currentColor" strokeOpacity=".25"/>
    <path d="M0 52 C 22 46 30 60 52 54 S 86 34 120 40" fill="none" stroke="currentColor" strokeOpacity=".45" strokeWidth="5"/>
    <g fill="none" stroke="currentColor" strokeOpacity=".2">
      <path d="M18 0v80M46 0v80M80 0v80M102 0v80M0 18h120M0 30h120M0 68h120"/>
      <path d="M0 6 L60 40 L120 74"/>
    </g>
    {[[30,24],[64,20],[88,58],[48,66]].map(([x,y],i)=><g key={i} className="origin-bottom transition-transform duration-500 group-hover/item:-translate-y-1" style={{transitionDelay:`${i*60}ms`}}>
      <path d={`M${x} ${y} c-4-5-6-8-6-11a6 6 0 0 1 12 0c0 3-2 6-6 11z`} fill="var(--accent)"/>
      <circle cx={x} cy={y-11} r="2" fill="var(--ct-header-bg,#f4e7cd)"/>
    </g>)}
  </svg>;
}

export default function MenuPreview({kind,data,signedIn}){
  if(kind==='dig')return <Stack items={data?.dig.items}/>;
  if(kind==='shelf')return signedIn===null
    ?<span className="flex h-full items-center"><span className="rounded-full border border-current/30 px-3 py-1.5 text-[11px] uppercase tracking-[.18em]">Log in to start</span></span>
    :<Stack items={data?.shelf?.items}/>;
  if(kind==='lego')return <Lego album={data?.dig.items?.[0]}/>;
  if(kind==='map')return <MapArt/>;
  return null;
}

// 패널에 붙는 숫자 한 줄
export function countLine(kind,data,signedIn){
  if(kind==='dig'&&data?.dig.count!=null)return `${data.dig.count.toLocaleString()} records`;
  if(kind==='shelf'&&signedIn&&data?.shelf?.count!=null)return `${data.shelf.count} records`;
  return null;
}
