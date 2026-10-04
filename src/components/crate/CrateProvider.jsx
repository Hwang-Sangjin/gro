'use client';
import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createSfx } from './sfx';
const Context=createContext(null);
export const useCrate=()=>useContext(Context);
export default function CrateProvider({children}) {
  const router=useRouter(), bridge=useRef({}), sfx=useRef(null);
  const [sound,setSound]=useState(false),[busy,setBusy]=useState(false);
  useEffect(()=>{ sfx.current=createSfx();return()=>sfx.current?.dispose(); },[]);
  // Sound starts off; AudioContext is created only by the toggle gesture.
  const value=useMemo(()=>({bridge,sfx,busy,setBusy,sound,
    go(href){ if(bridge.current.go)bridge.current.go(href);else router.push(href,{scroll:false}); },
    async toggleSound(){const next=!sound;try{await sfx.current?.setEnabled(next);setSound(next);}catch{setSound(false);}},
  }),[router,busy,sound]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
