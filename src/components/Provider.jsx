"use client";

import { useEffect, useRef } from "react";
import { ReactLenis } from "lenis/react";
import { usePathname } from "next/navigation";

import { IntroProvider, useIntro } from "./intro/intro-context";
import Preloader from "./intro/Preloader";
import CrateProvider from "./crate/CrateProvider";
import CrateStage from "./crate/CrateStage";
import AlbumTransitionProvider from "./album/AlbumTransitionProvider";
import SpinningFavicon from "./SpinningFavicon";
import SiteCursor from "./SiteCursor";

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

// 배경 테스트 페이지(/lab/env-test)는 인트로 없이 바로 열리게: 인트로를 끝난 것으로만 표시
function SkipIntro() {
  const { finish } = useIntro();
  useEffect(() => { finish(); }, [finish]);
  return null;
}

export default function Providers({ children }) {
  const lenisRef = useRef(null);
  const skipIntro = usePathname()?.startsWith("/lab/env-test");

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
