"use client";

import dynamic from "next/dynamic";

const HeroVinylCanvas = dynamic(() => import("./HeroVinylCanvas"), { ssr: false });

export default function HeroSection() {
  return (
    <section className="relative isolate h-svh w-full flex-none overflow-hidden text-inherit" aria-labelledby="hero-title">
      <div className="absolute inset-0 z-0" aria-hidden="true">
        <HeroVinylCanvas />
      </div>
      <div className="pointer-events-none absolute inset-0 z-[1] grid place-items-center px-[4vw]">
        <h1 id="hero-title" className="visible m-0 whitespace-nowrap text-center font-['Grooves_Bodoni',Georgia,serif] text-[22vw] leading-none font-black tracking-[-0.055em]">Grooves</h1>
      </div>
    </section>
  );
}
