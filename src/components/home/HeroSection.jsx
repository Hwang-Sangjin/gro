"use client";
import { useRef } from "react";

import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { SplitText } from "gsap/SplitText";

import { useIntro } from "@/components/intro/intro-context";

gsap.registerPlugin(useGSAP, SplitText);

// 인트로 착지 직후의 짧은 숨. 페이지 전환으로 들어올 땐 page-in 애니메이션에 맞춘 1.125s.
const DELAY_AFTER_INTRO = 0.15;
const DELAY_AFTER_TRANSITION = 1.125;

export default function HeroSection() {
  const section = useRef();
  const titleRef = useRef();

  const { done } = useIntro();
  // 마운트 시점에 이미 done이면 = 인트로가 아니라 페이지 전환으로 들어온 것
  const viaTransition = useRef(done);

  useGSAP(
    () => {
      if (!done) return; // 인트로 중에는 숨긴 채로 대기

      const heroText = new SplitText(titleRef.current, {
        type: "chars",
        mask: "chars",
      });

      gsap.set(heroText.chars, { yPercent: 100 });
      gsap.set(titleRef.current, { visibility: "visible" });

      gsap.to(heroText.chars, {
        yPercent: 0,
        duration: 1,
        stagger: 0.075,
        ease: "power3.out",
        delay: viaTransition.current
          ? DELAY_AFTER_TRANSITION
          : DELAY_AFTER_INTRO,
      });
    },
    { scope: section, dependencies: [done] },
  );

  return (
    <section className="home-hero" ref={section}>
      <h1 ref={titleRef}>Grooves</h1>
      <span className="home-scroll">scroll ↓</span>
    </section>
  );
}
