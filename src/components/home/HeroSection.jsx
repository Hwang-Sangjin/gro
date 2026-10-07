"use client";

import { useRef } from "react";
import { useIntro } from "../intro/intro-context";
import HeroCursor from "./HeroCursor";

import dynamic from "next/dynamic";

const HeroVinylCanvas = dynamic(() => import("./HeroVinylCanvas"), { ssr: false });

export default function HeroSection() {
  const sectionRef = useRef(null);
  const titleRef = useRef(null);
  const { done } = useIntro();
  return (
    <section ref={sectionRef} className="relative isolate h-svh w-full flex-none overflow-hidden text-inherit" aria-labelledby="hero-title">
      <div className="absolute inset-0 z-0" aria-hidden="true">
        <HeroVinylCanvas sectionRef={sectionRef} titleRef={titleRef} active={done} />
      </div>
      <div className="pointer-events-none absolute inset-0 z-[1] grid place-items-center px-[4vw]">
        <h1 ref={titleRef} id="hero-title" className="visible m-0 whitespace-nowrap text-center font-['Grooves_Bodoni',Georgia,serif] text-[18vw] leading-none font-black tracking-[-0.055em]">Grooves</h1>
      </div>
      <HeroCursor />
    </section>
  );
}
