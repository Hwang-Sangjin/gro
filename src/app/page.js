"use client";
import { useRef } from "react";

import PageShell from "@/components/layout/PageShell";
import useWireProgress from "@/components/home/useWireProgress";

import HeroSection from "@/components/home/HeroSection";
import NewVinylsSection from "@/components/home/NewVinylsSection";
import CategorySection from "@/components/home/CategorySection";
import NewsSection from "@/components/home/NewsSection";

export default function Home() {
  const veilInRef = useRef();
  const veilOutRef = useRef();

  useWireProgress({ inRef: veilInRef, outRef: veilOutRef });

  return (
    <PageShell className="home">
      {/* 01 — Hero (크림) */}
      <HeroSection />

      {/* 크림 → 잉크 */}
      <div className="home-veil" ref={veilInRef} aria-hidden="true" />

      {/* 02 — New vinyls (잉크) */}
      <NewVinylsSection />

      {/* 03 — Category (잉크) */}
      <CategorySection />

      {/* 잉크 → 크림 */}
      <div className="home-veil" ref={veilOutRef} aria-hidden="true" />

      {/* 04 — News (크림) */}
      <NewsSection />
    </PageShell>
  );
}
