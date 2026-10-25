'use client';
// 헤더 펼침 패널 속 작은 그림 — Digging: 최근 등록된 커버 3장 / Collection: 내 판 3장 / Brick: 최근 커버를 브릭 판으로 / Map: 우리 지도 + 바이닐 마커
import {useEffect,useId,useRef,useState} from 'react';
import {authClient} from '@/lib/useAuthUser';
import {coverUrl} from '@/lib/albums';
import {useTheme} from '@/lib/theme';
import {PALETTES} from '@/lib/map/style';

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

// 커버 한 장을 브릭 판으로 — Brick 페이지와 같은 팔레트로 색을 맞추고, 칸마다 네모 플레이트 + 둥근 스터드
const BN=20, CELL=12;   // 20×20 브릭, 칸 하나 12px → 240px 캔버스 (화면에선 줄여서 선명하게)
function drawBricks(c,cells,hexes){
  const g=c.getContext('2d');
  g.fillStyle='#141113';g.fillRect(0,0,c.width,c.height);   // 판 바닥 (틈이 검게)
  for(let i=0;i<BN*BN;i++){
    const x=(i%BN)*CELL,y=Math.floor(i/BN)*CELL,hex=hexes(i);
    g.fillStyle=hex;g.fillRect(x+.5,y+.5,CELL-1,CELL-1);
    // 플레이트 가장자리: 위·왼쪽 밝게, 아래·오른쪽 어둡게
    g.fillStyle='rgba(255,255,255,.12)';g.fillRect(x+.5,y+.5,CELL-1,1);g.fillRect(x+.5,y+.5,1,CELL-1);
    g.fillStyle='rgba(0,0,0,.18)';g.fillRect(x+.5,y+CELL-1.5,CELL-1,1);g.fillRect(x+CELL-1.5,y+.5,1,CELL-1);
    // 스터드: 그림자 → 몸통 → 왼쪽 위 빛
    const cx=x+CELL/2,cy=y+CELL/2,r=CELL*.3;
    g.fillStyle='rgba(0,0,0,.28)';g.beginPath();g.arc(cx+.8,cy+1,r,0,Math.PI*2);g.fill();
    g.fillStyle=hex;g.beginPath();g.arc(cx,cy,r,0,Math.PI*2);g.fill();
    g.strokeStyle='rgba(255,255,255,.35)';g.lineWidth=1;g.beginPath();g.arc(cx,cy,r-.6,Math.PI*1.05,Math.PI*1.75);g.stroke();
  }
}
function Brick({album}){
  const ref=useRef(null);
  useEffect(()=>{
    const c=ref.current;if(!c||!album?.thumb_path)return;
    let off=false;
    const img=new Image();img.crossOrigin='anonymous';
    img.onload=async()=>{
      if(off)return;
      try{
        const [{sampleImage,buildMosaic},{PALETTE}]=await Promise.all([import('@/lib/brick/mosaic'),import('@/lib/brick/palette')]);
        const m=buildMosaic(sampleImage(img,null,BN),BN);
        if(!off)drawBricks(c,m.cells,i=>PALETTE[m.cells[i]].hex);
      }catch{
        // 다른 사이트 이미지라 색을 못 읽으면: 작게 줄인 그림 색을 그대로
        const t=document.createElement('canvas');t.width=t.height=BN;const tg=t.getContext('2d');tg.drawImage(img,0,0,BN,BN);
        try{const d=tg.getImageData(0,0,BN,BN).data;drawBricks(c,null,i=>`rgb(${d[i*4]},${d[i*4+1]},${d[i*4+2]})`);}catch{}
      }
    };
    img.src=coverUrl(album.thumb_path);
    return()=>{off=true;};
  },[album?.thumb_path]);
  return <span className="block aspect-square h-[82%] rounded-[3px] bg-[#141113] p-[3px] shadow-[0_14px_22px_-12px_rgba(0,0,0,.6)] transition-transform duration-700 ease-[cubic-bezier(.22,1,.36,1)] [transform:perspective(500px)_rotateX(10deg)_rotateZ(-3deg)] group-hover/item:[transform:perspective(500px)_rotateX(0deg)_rotateZ(0deg)_translateY(-4px)]"
    style={{background:album?.thumb_path?undefined:'#c9a27a'}}>
    <canvas ref={ref} width={BN*CELL} height={BN*CELL} className="block size-full rounded-[1px]"/>
  </span>;
}

// 우리 지도 색으로 그린 작은 동네 + 바이닐 디스크 마커 (하나는 영업 중이라 돌고, 이름표가 뜸)
function MapArt(){
  const theme=useTheme()==='dark'?'dark':'light';
  const P=PALETTES[theme];
  const clip=`mapart-${useId().replace(/:/g,'')}`;   // 헤더가 페이지마다 있어서 id 가 겹치지 않게
  const discs=[{x:38,y:30,c:'#2d6a6a'},{x:96,y:44,c:'#a63c2a',spin:true,tag:true},{x:132,y:22,c:'#6f8fb6'},{x:70,y:74,c:'#c9952c'}];
  return <svg viewBox="0 0 160 100" className="h-[82%] w-auto overflow-visible rounded-[3px] shadow-[0_14px_22px_-12px_rgba(0,0,0,.45)]" aria-hidden="true">
    <defs><clipPath id={clip}><rect width="160" height="100" rx="3"/></clipPath></defs>
    <g clipPath={`url(#${clip})`}>
      <rect width="160" height="100" fill={P.land}/>
      {/* 주거 블록 */}
      <g fill={P.landuse}>{[[6,6,26,16],[40,4,30,14],[78,8,22,16],[112,4,40,12],[6,42,22,18],[108,56,30,14],[6,70,30,12]].map(([x,y,w,h],i)=><rect key={i} x={x} y={y} width={w} height={h} rx="1"/>)}</g>
      {/* 숲길 (경의선 숲길처럼 비스듬한 띠) */}
      <path d="M-4 66 L70 40 L164 18" fill="none" stroke={P.park} strokeWidth="9" strokeLinecap="round"/>
      {/* 강 */}
      <path d="M-4 92 C 30 84 60 98 96 90 S 140 80 164 86 L164 104 L-4 104 Z" fill={P.water}/>
      {/* 큰길: 테두리 + 안쪽 */}
      <g fill="none" strokeLinecap="round">
        <path d="M0 36 L160 52 M58 0 L50 100" stroke={P.roadCase} strokeWidth="5"/>
        <path d="M0 36 L160 52 M58 0 L50 100" stroke={P.road} strokeWidth="3"/>
        <path d="M0 20 L60 26 M86 0 L92 100 M120 0 L114 80 M0 58 L54 54" stroke={P.road} strokeWidth="1.2" strokeOpacity=".9"/>
      </g>
    </g>
    {discs.map((d,i)=><g key={i} className="transition-transform duration-500 ease-[cubic-bezier(.22,1,.36,1)] group-hover/item:-translate-y-[3px]" style={{transitionDelay:`${i*50}ms`}}>
      <circle cx={d.x+.6} cy={d.y+1.2} r="6.4" fill="rgba(0,0,0,.35)"/>
      <circle cx={d.x} cy={d.y} r="6.4" fill="#141113"/>
      <circle cx={d.x} cy={d.y} r="4.4" fill="none" stroke="rgba(255,255,255,.12)" strokeWidth=".5"/>
      {d.spin&&<path d={`M${d.x} ${d.y} L${d.x+6} ${d.y-2} A6.4 6.4 0 0 1 ${d.x+4.6} ${d.y+4.4} Z`} fill="rgba(255,255,255,.2)">
        <animateTransform attributeName="transform" type="rotate" from={`0 ${d.x} ${d.y}`} to={`360 ${d.x} ${d.y}`} dur="2.4s" repeatCount="indefinite"/>
      </path>}
      <circle cx={d.x} cy={d.y} r="2" fill={d.c} stroke="#141113" strokeWidth=".8"/>
      {d.tag&&<g>
        <rect x={d.x-21} y={d.y-19.5} width="42" height="10" rx="1" fill={theme==='dark'?'#f4e7cd':'#4c404a'}/>
        <text x={d.x} y={d.y-12.6} textAnchor="middle" fontSize="5.2" fontWeight="600" letterSpacing=".3" fontFamily="Hahmlet, Georgia, serif" fill={theme==='dark'?'#4c404a':'#f4e7cd'}>OPEN NOW</text>
      </g>}
    </g>)}
  </svg>;
}

export default function MenuPreview({kind,data,signedIn}){
  if(kind==='dig')return <Stack items={data?.dig.items}/>;
  if(kind==='shelf')return signedIn===null
    ?<span className="flex h-full items-center"><span className="rounded-full border border-current/30 px-3 py-1.5 text-[11px] uppercase tracking-[.18em]">Log in to start</span></span>
    :<Stack items={data?.shelf?.items}/>;
  if(kind==='brick')return <Brick album={data?.dig.items?.[0]}/>;
  if(kind==='map')return <MapArt/>;
  return null;
}

// 패널에 붙는 숫자 한 줄
export function countLine(kind,data,signedIn){
  if(kind==='dig'&&data?.dig.count!=null)return `${data.dig.count.toLocaleString()} records`;
  if(kind==='shelf'&&signedIn&&data?.shelf?.count!=null)return `${data.shelf.count} records`;
  return null;
}
