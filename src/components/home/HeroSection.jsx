"use client";
import { useRef } from "react";

import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { SplitText } from "gsap/SplitText";
import { Canvas } from "@react-three/fiber";

import { useIntro } from "@/components/intro/intro-context";
import HeroScene from "./HeroScene";

gsap.registerPlugin(useGSAP, SplitText);

// 인트로 착지 직후의 짧은 숨. 페이지 전환으로 들어올 땐 page-in 애니메이션에 맞춘 1.125s.
const DELAY_AFTER_INTRO = 0.15;
const DELAY_AFTER_TRANSITION = 1.125;

// 중앙에 떠 있을 때의 배율. CSS 최종 크기(10vw)의 2배 = 20vw
const HERO_SCALE = 2;

// 워드마크 이동과 같은 길이·같은 이징 — 두 움직임이 한 동작으로 읽히게
const MOVE_DURATION = 1.4;
const MOVE_EASE = "power3.inOut";

export default function HeroSection() {
  const section = useRef();
  const titleRef = useRef();
  const scrollRef = useRef();
  const stageRef = useRef();

  const { done } = useIntro();
  // 마운트 시점에 이미 done이면 = 인트로가 아니라 페이지 전환으로 들어온 것
  const viaTransition = useRef(done);

  useGSAP(
    () => {
      if (!done) return; // 인트로 중에는 숨긴 채로 대기

      const title = titleRef.current;

      const heroText = new SplitText(title, {
        type: "chars",
        mask: "chars",
      });

      // 최종 위치에서 잰 박스. 여기서 "중앙 + 확대" 로 가는 델타를 역산한다
      const rect = title.getBoundingClientRect();
      const toCenter = {
        x: (window.innerWidth - rect.width * HERO_SCALE) / 2 - rect.left,
        y: (window.innerHeight - rect.height * HERO_SCALE) / 2 - rect.top,
      };

      gsap.set(title, {
        x: toCenter.x,
        y: toCenter.y,
        scale: HERO_SCALE,
        visibility: "visible",
      });
      gsap.set(heroText.chars, { yPercent: 100 });

      // 3D 는 화면 아래에 대기. yPercent 라 뷰포트 높이에 안 묶인다
      gsap.set(stageRef.current, { yPercent: 80, opacity: 0 });

      const tl = gsap.timeline({
        delay: viaTransition.current
          ? DELAY_AFTER_TRANSITION
          : DELAY_AFTER_INTRO,
      });

      // ① 중앙에서 글자가 마스크 밖으로 올라온다
      tl.to(heroText.chars, {
        yPercent: 0,
        duration: 1,
        stagger: 0.075,
        ease: "power3.out",
      });

      // ② 잠깐 머문 뒤 좌상단 제자리로 축소 이동
      tl.to(
        title,
        {
          x: 0,
          y: 0,
          scale: 1,
          duration: MOVE_DURATION,
          ease: MOVE_EASE,
        },
        "+=0.45",
      );

      // ③ 같은 시점·같은 이징으로 3D 가 아래에서 올라온다.
      //    opacity 는 더 짧게 끝내서 "떠오르는" 느낌만 남기고 이동은 계속되게
      tl.to(
        stageRef.current,
        { yPercent: 0, duration: MOVE_DURATION, ease: MOVE_EASE },
        "<0.5",
      );
      tl.to(
        stageRef.current,
        { opacity: 1, duration: MOVE_DURATION * 1.6, ease: "power2.out" },
        "<",
      );

      // ④ 착지 끝물에 스크롤 힌트
      tl.to(
        scrollRef.current,
        { opacity: 0.6, duration: 0.6, ease: "power2.out" },
        "-=0.5",
      );

      return () => heroText.revert();
    },
    { scope: section, dependencies: [done] },
  );

  return (
    <section className="home-hero" ref={section}>
      <div className="home-stage" ref={stageRef} aria-hidden="true">
        <Canvas
          camera={{ position: [0, 0.6, 6], fov: 42 }}
          gl={{ alpha: true, antialias: true }}
          dpr={[1, 2]}
        >
          <HeroScene />
        </Canvas>
      </div>

      <h1 ref={titleRef}>Grooves</h1>

      <span className="home-scroll" ref={scrollRef}>
        scroll ↓
      </span>
    </section>
  );
}
