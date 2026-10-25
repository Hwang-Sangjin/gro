'use client';
// 헤더 펼침 패널 속 작은 그림 — Digging: 최근 등록된 커버 3장 / Collection: 내 판 3장 / Brick·Map: 실제 화면 이미지
import {useEffect,useState} from 'react';
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

// Lab 썸네일 — 실제 화면에서 뜬 이미지 (public/images/lab): Brick 은 커버를 브릭으로 끼운 판, Map 은 지도 위 바이닐 마커
function LabThumb({src}){
  return <span className="block h-[82%] overflow-hidden rounded-[3px] shadow-[0_14px_22px_-12px_rgba(0,0,0,.55)] transition-transform duration-700 ease-[cubic-bezier(.22,1,.36,1)] group-hover/item:-translate-y-1 group-hover/item:scale-[1.03]">
    <img src={src} alt="" loading="lazy" decoding="async" draggable={false} className="block h-full w-auto select-none"/>
  </span>;
}

export default function MenuPreview({kind,data,signedIn}){
  if(kind==='dig')return <Stack items={data?.dig.items}/>;
  if(kind==='shelf')return signedIn===null
    ?<span className="flex h-full items-center"><span className="rounded-full border border-current/30 px-3 py-1.5 text-[11px] uppercase tracking-[.18em]">Log in to start</span></span>
    :<Stack items={data?.shelf?.items}/>;
  if(kind==='brick')return <LabThumb src="/images/lab/brick-thumb.webp"/>;
  if(kind==='map')return <LabThumb src="/images/lab/map-thumb.webp"/>;
  return null;
}

// 패널에 붙는 숫자 한 줄
export function countLine(kind,data,signedIn){
  if(kind==='dig'&&data?.dig.count!=null)return `${data.dig.count.toLocaleString()} records`;
  if(kind==='shelf'&&signedIn&&data?.shelf?.count!=null)return `${data.shelf.count} records`;
  return null;
}
