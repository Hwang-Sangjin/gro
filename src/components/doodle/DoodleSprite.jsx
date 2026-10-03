'use client';
import {useCallback,useEffect,useState,useSyncExternalStore} from 'react';
import {subscribe,frame} from './doodleClock';
export default function DoodleSprite({id,className='',...props}){
  const [reduced,setReduced]=useState(false);
  useEffect(()=>{const q=matchMedia('(prefers-reduced-motion: reduce)'),update=()=>setReduced(q.matches);update();q.addEventListener('change',update);return()=>q.removeEventListener('change',update);},[]);
  const sub=useCallback(fn=>reduced?()=>{}:subscribe(id,fn),[id,reduced]);
  const get=useCallback(()=>frame(id),[id]);
  const index=useSyncExternalStore(sub,get,()=>0);
  useEffect(()=>{for(let i=0;i<6;i++){const img=new Image();img.src=`/doodles/${id}/${i}.webp`;}},[id]);
  return <img {...props} src={`/doodles/${id}/${reduced?0:index}.webp`} className={className} alt="" width="512" height="512" draggable={false}/>;
}
