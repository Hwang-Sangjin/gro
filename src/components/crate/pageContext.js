'use client';
import { createContext, useContext } from 'react';

// 각 CratePage가 자신이 "떠나는 페이지"인지 알려준다.
// 떠나는 페이지는 화면에서 사라지는 중이므로 WebGL 렌더 루프 등 무거운 작업을 멈춰도 된다.
export const CratePageContext = createContext({ leaving: false });
export const useLeavingPage = () => useContext(CratePageContext).leaving;
