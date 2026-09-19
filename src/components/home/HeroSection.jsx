"use client";
import { useRef } from "react";

import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { SplitText } from "gsap/SplitText";
import { Canvas } from "@react-three/fiber";

import { useIntro } from "@/components/intro/intro-context";
import HeroScene from "./HeroScene";
import PaperFadePass from "./PaperFadePass";
import VinylMark from "./VinylMark";
import useInViewport from "./useInViewport";

gsap.registerPlugin(useGSAP, SplitText);

const DELAY_AFTER_INTRO = 0.15;
const DELAY_AFTER_TRANSITION = 1.125;

// 11vw 세리프는 2배면 화면을 넘는다 → 1.6배
const HERO_SCALE = 1.6;

const MOVE_DURATION = 1.4;
const MOVE_EASE = "power3.inOut";

// 직접 튜닝했던 값이 있으면 여기로 옮기세요
const STAGE_DELAY = 0.5;
const STAGE_FADE = 1.4;

export default function HeroSection() {
  const section = useRef();
  const titleRef = useRef();
  const markRef = useRef();
  const ruleRef = useRef();
  const scrollRef = useRef();
  const stageRef = useRef();
  const hoverRef = useRef(false); // state 아님 — 리렌더 없이 셰이더로만 전달

  const { done } = useIntro();
  const viaTransition = useRef(done);

  // 화면 밖으로 나가면 렌더 루프를 끈다. New vinyls 구간에서 GPU 를 비워준다
  const heroVisible = useInViewport(stageRef);

  useGSAP(
    () => {
      if (!done) return;

      const title = titleRef.current;
      const heroText = new SplitText(title, { type: "chars", mask: "chars" });

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
      gsap.set(stageRef.current, { yPercent: 60, opacity: 0 });
      gsap.set(markRef.current, { opacity: 0, scale: 0.8, rotate: -20 });

      const tl = gsap.timeline({
        delay: viaTransition.current
          ? DELAY_AFTER_TRANSITION
          : DELAY_AFTER_INTRO,
      });

      // ① 중앙에서 글자 리빌
      tl.to(heroText.chars, {
        yPercent: 0,
        duration: 1,
        stagger: 0.075,
        ease: "power3.out",
      });

      // ② 좌상단으로 착지 — 이후 트윈은 전부 이 라벨 기준
      tl.addLabel("land", "+=0.45");
      tl.to(
        title,
        { x: 0, y: 0, scale: 1, duration: MOVE_DURATION, ease: MOVE_EASE },
        "land",
      );

      // ③ 3D 가 아래에서 올라온다
      tl.to(
        stageRef.current,
        { yPercent: 0, duration: MOVE_DURATION, ease: MOVE_EASE },
        `land+=${STAGE_DELAY}`,
      );
      tl.to(
        stageRef.current,
        { opacity: 1, duration: STAGE_FADE, ease: "power2.out" },
        `land+=${STAGE_DELAY}`,
      );

      // ④ 착지 끝물에 밑줄이 좌→우로 그어지고, 그 끝에서 바이닐 마크가 돌아 들어온다
      tl.to(
        ruleRef.current,
        { scaleX: 1, duration: 1.1, ease: "power3.inOut" },
        `land+=${MOVE_DURATION - 0.5}`,
      );
      tl.to(
        markRef.current,
        { opacity: 1, scale: 1, rotate: 0, duration: 0.9, ease: "power3.out" },
        "<0.35",
      );

      // ⑤ 스크롤 힌트
      tl.to(
        scrollRef.current,
        { opacity: 0.6, duration: 0.6, ease: "power2.out" },
        "-=0.4",
      );

      return () => heroText.revert();
    },
    { scope: section, dependencies: [done] },
  );

  return (
    <section className="home-hero" ref={section}>
      <div
        className="home-stage"
        ref={stageRef}
        aria-hidden="true"
        onPointerEnter={() => (hoverRef.current = true)}
        onPointerLeave={() => (hoverRef.current = false)}
      >
        {/* flat: 톤매핑을 꺼야 #bbcbda 가 정확히 그 색으로 나온다 */}
        <Canvas
          flat
          frameloop={heroVisible ? "always" : "never"}
          camera={{ position: [0, 0.6, 6], fov: 42 }}
          gl={{ alpha: true, antialias: true }}
          dpr={[1, 1.75]}
        >
          <HeroScene />
          <PaperFadePass hoverRef={hoverRef} />
        </Canvas>
      </div>

      <div className="home-title">
        <div className="home-title-row">
          <h1 className="ink-grain" ref={titleRef}>
            Grooves
          </h1>
          <VinylMark className="home-title-mark ink-grain" ref={markRef} />
        </div>
        <span className="home-title-rule ink-grain" ref={ruleRef} />
      </div>

      <span className="home-scroll" ref={scrollRef}>
        scroll ↓
      </span>
    </section>
  );
}
