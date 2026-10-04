"use client";
import { useCrate } from "@/components/crate/CrateProvider";
import HomeDecoration from "./HomeDecoration";
import { Suspense, useRef, useState } from "react";
import Image from "next/image";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { SplitText } from "gsap/SplitText";
import { Canvas } from "@react-three/fiber";
import { useIntro } from "@/components/intro/intro-context";
import HeroScene from "./HeroScene";
import FullscreenRoom from "./FullscreenRoom";
import "./HeroInteraction.css";
import PaperFadePass from "./PaperFadePass";
import useInViewport from "./useInViewport";

gsap.registerPlugin(useGSAP, SplitText);

export default function HeroSection() {
  const { busy } = useCrate();
  const [expanded, setExpanded] = useState(false);
  const openButtonRef = useRef(null);
  const section = useRef();
  const titleRef = useRef();
  const markRef = useRef();
  const ruleRef = useRef();
  const scrollRef = useRef();
  const stageRef = useRef();
  const decorationRef = useRef();
  const taglineRef = useRef();
  const hoverRef = useRef(false);
  const { done } = useIntro();
  const viaTransition = useRef(done);
  const heroVisible = useInViewport(stageRef);

  useGSAP(() => {
    if (!done) return;
    let cancelled = false;
    let animationContext;
    let split;
    const start = async () => {
      // Wait for the exact display face before measuring SplitText.
      await document.fonts.load('900 100px "Grooves Bodoni"').catch(() => {});
      if (cancelled) return;
      animationContext = gsap.context(() => {
        const title = titleRef.current;
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
          gsap.set(title, { visibility: "visible", x: 0, y: 0, scale: 1 });
          gsap.set([stageRef.current, markRef.current, scrollRef.current], { opacity: 1, yPercent: 0 });
          gsap.set(decorationRef.current, { opacity: 1 });
          gsap.set(taglineRef.current, { opacity: .9, yPercent: 0, y: 0 });
          gsap.set(ruleRef.current, { scaleX: 1 });
          return;
        }
        split = new SplitText(title, { type: "chars", mask: "chars" });
        const rect = title.getBoundingClientRect();
        const scale = Math.min(1.6, (window.innerWidth - 40) / rect.width);
        gsap.set(title, {
          x: (window.innerWidth - rect.width * scale) / 2 - rect.left,
          y: (window.innerHeight - rect.height * scale) / 2 - rect.top,
          scale, visibility: "visible",
        });
        gsap.set(split.chars, { yPercent: 110 });
        gsap.set(stageRef.current, { yPercent: 35, opacity: 0 });
        gsap.set(decorationRef.current, { opacity: 0 });
        gsap.set(taglineRef.current, { opacity: 0, y: 0, yPercent: 110 });
        gsap.set(markRef.current, { opacity: 0, scale: .85, rotate: -12 });
        const tl = gsap.timeline({ delay: viaTransition.current ? 1.125 : .15 });
        tl.to(split.chars, { yPercent: 0, duration: 1, stagger: .075, ease: "power3.out" })
          .addLabel("land", "+=.45")
          .to(title, { x: 0, y: 0, scale: 1, duration: 1.4, ease: "power3.inOut" }, "land")
          .to(stageRef.current, { yPercent: 0, opacity: 1, duration: 1.4, ease: "power3.inOut" }, "land+=.5")
          .to(decorationRef.current, { opacity: 1, duration: 1.4, ease: "power3.inOut" }, "land+=.5")
          .to(taglineRef.current, { opacity: .9, yPercent: 0, duration: .65, ease: "power3.out" }, "land+=2.05")
          .to(ruleRef.current, { scaleX: 1, duration: 1.1, ease: "power3.inOut" }, "land+=.9")
          .to(markRef.current, { opacity: 1, scale: 1, rotate: 0, duration: .9, ease: "power3.out" }, "land+=1.25")
          .to(scrollRef.current, { opacity: .6, duration: .6 }, "-=.4");
      }, section);
    };
    start();
    return () => { cancelled = true; animationContext?.revert(); split?.revert(); };
  }, { scope: section, dependencies: [done], revertOnUpdate: true });

  return (
    <section className="home-hero" ref={section}>
      <HomeDecoration name="vinyl-disk" side="left" visible={done} top="59%" reveal="hero" elementRef={decorationRef} captionRef={taglineRef} />
      <div className="home-stage" ref={stageRef}
        onPointerEnter={() => (hoverRef.current = true)}
        onPointerLeave={() => (hoverRef.current = false)}
        onPointerCancel={() => (hoverRef.current = false)}>
        <Canvas flat resize={{ offsetSize: true }} frameloop={busy ? "demand" : heroVisible && !expanded ? "always" : "never"}
          camera={{ position: [0, .6, 6], fov: 42 }}
          gl={{ alpha: true, antialias: true }} dpr={[1, 1.75]}>
          <Suspense fallback={null}>
            <HeroScene />
          </Suspense>
          <PaperFadePass hoverRef={hoverRef} />
        </Canvas>
        <button ref={openButtonRef} type="button" className="grooves-scene-open"
          aria-label="3D 리스닝 룸 전체화면으로 보기" aria-haspopup="dialog"
          onClick={() => setExpanded(true)}><span>Explore the room ↗</span></button>
      </div>
      <div className="home-title">
        <div className="home-title-row">
          <h1 className="ink-grain" ref={titleRef}>Grooves</h1>
          <span className="home-title-mark" ref={markRef} aria-hidden="true">
            <Image src="/images/grooves/vinyl-mark.png" alt="" fill
              sizes="(max-width: 600px) 21vw, 280px" priority />
          </span>
        </div>
        <span className="home-title-rule ink-grain" ref={ruleRef} />

      </div>
      {expanded && <FullscreenRoom onClose={() => setExpanded(false)} returnFocusRef={openButtonRef} />}
      <span className="home-scroll" ref={scrollRef}>scroll ↓</span>
    </section>
  );
}
