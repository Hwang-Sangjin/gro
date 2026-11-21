"use client";

import { useEffect, useRef, useState } from "react";
import { ReactLenis } from "lenis/react";
import { usePathname } from "next/navigation";

import { IntroProvider, useIntro } from "./intro/intro-context";
import Preloader from "./intro/Preloader";
import CrateProvider from "./crate/CrateProvider";
import CrateStage from "./crate/CrateStage";
import AlbumTransitionProvider from "./album/AlbumTransitionProvider";
import SpinningFavicon from "./SpinningFavicon";
import SiteCursor from "./SiteCursor";
import { isHomeRoute } from "@/lib/homeReady";

// 인트로가 끝날 때까지 Lenis와 네이티브 스크롤을 모두 잠근다.
function ScrollLock({ lenisRef }) {
  const { done } = useIntro();

  useEffect(() => {
    const lenis = lenisRef.current?.lenis;

    if (done) {
      lenis?.start();
      document.body.classList.remove("intro-locked");
    } else {
      lenis?.stop();
      document.body.classList.add("intro-locked");
    }

    return () => document.body.classList.remove("intro-locked");
  }, [done, lenisRef]);

  return null;
}

// 인트로 없이 바로 열리는 페이지: 인트로를 끝난 것으로만 표시
function SkipIntro() {
  const { finish } = useIntro();
  useEffect(() => { finish(); }, [finish]);
  return null;
}

export default function Providers({ children }) {
  const lenisRef = useRef(null);
  // 인트로(바이닐 프리로더)는 3D 방을 준비해야 하는 Home 에서만. 다른 페이지로 바로 들어오면(검색 · 공유 링크) 건너뜀
  //  — 글은 이미 HTML 에 있는데 인트로가 최소 3.5초 동안 덮고 있었음
  //  처음 들어온 주소로 한 번만 정함: 사이트 안에서 Home 으로 옮겨 올 때 인트로가 뒤늦게 뜨지 않게
  const pathname = usePathname();
  const [skipIntro] = useState(() => !isHomeRoute(pathname ?? "/"));

  return (
    <IntroProvider>
      <ReactLenis root ref={lenisRef} />
      <ScrollLock lenisRef={lenisRef} />
      {skipIntro ? <SkipIntro /> : <Preloader />}
      <SpinningFavicon />
      <SiteCursor />
      <CrateProvider>
      <AlbumTransitionProvider>
        <CrateStage>{children}</CrateStage>
      </AlbumTransitionProvider>
      </CrateProvider>
    </IntroProvider>
  );
}
