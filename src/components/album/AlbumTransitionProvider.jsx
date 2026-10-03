'use client';
import {createContext,useCallback,useContext,useMemo} from 'react';
import {useCrate} from '../crate/CrateProvider';
const Context=createContext(null);
export const useAlbumTransition=()=>useContext(Context);
// Preserve existing album-card API; route through the one site-wide transition.
export default function AlbumTransitionProvider({children}){
  const {go}=useCrate();
  const openAlbum=useCallback(({slug})=>go(`/album/${encodeURIComponent(slug)}`),[go]);
  const value=useMemo(()=>({openAlbum}),[openAlbum]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
