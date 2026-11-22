'use client';
import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createSfx } from './sfx';
import { getSoundPref, setSoundPref, untilGesture } from '@/lib/soundPref';
const Context=createContext(null);
export const useCrate=()=>useContext(Context);
export default function CrateProvider({children}) {
  const router=useRouter(), bridge=useRef({}), sfx=useRef(null), wait=useRef(null);
  const [sound,setSound]=useState(false),[busy,setBusy]=useState(false);
  useEffect(()=>{ sfx.current=createSfx();return()=>sfx.current?.dispose(); },[]);
  // 소리는 기본으로 켜져 있음 (사용자가 껐으면 그대로 꺼 둠 — lib/soundPref.js).
  // 브라우저가 첫 누름 · 키 입력 전에는 소리를 막으므로, 오디오는 그 첫 입력 때 만들어짐
  useEffect(()=>{
    if(!getSoundPref())return;
    setSound(true);
    wait.current=untilGesture(()=>{ if(!sfx.current)return false; sfx.current.setEnabled(true).catch(()=>{}); return true; });
    return()=>wait.current?.();
  },[]);
  const value=useMemo(()=>({bridge,sfx,busy,setBusy,sound,
    go(href){ if(bridge.current.go)bridge.current.go(href);else router.push(href,{scroll:false}); },
    async toggleSound(){
      const next=!sound; wait.current?.(); setSoundPref(next);
      try{await sfx.current?.setEnabled(next);setSound(next);}catch{setSound(false);}
    },
  }),[router,busy,sound]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
