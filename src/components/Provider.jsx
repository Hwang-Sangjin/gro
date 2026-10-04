"use client";

import { useEffect, useRef } from "react";
import { ReactLenis } from "lenis/react";

import { IntroProvider, useIntro } from "./intro/intro-context";
import Preloader from "./intro/Preloader";
import CrateProvider from "./crate/CrateProvider";
import CrateStage from "./crate/CrateStage";
import AlbumTransitionProvider from "./album/AlbumTransitionProvider";

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

export default function Providers({ children }) {
  const lenisRef = useRef(null);

  return (
    <IntroProvider>
      <ReactLenis root ref={lenisRef} />
      <ScrollLock lenisRef={lenisRef} />
      <Preloader />
      <CrateProvider>
      <AlbumTransitionProvider>
        <CrateStage>{children}</CrateStage>
      </AlbumTransitionProvider>
      </CrateProvider>
    </IntroProvider>
  );
}
