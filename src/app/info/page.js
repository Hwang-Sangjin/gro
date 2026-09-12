"use client";
import { useRef } from "react";

import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { SplitText } from "gsap/SplitText";

import { useIntro } from "@/components/intro/intro-context";

gsap.registerPlugin(useGSAP, SplitText);

const DELAY_AFTER_INTRO = 0.15;
const DELAY_AFTER_TRANSITION = 0.5;

const Info = () => {
  const container = useRef();
  const textRef = useRef();

  const { done } = useIntro();
  const viaTransition = useRef(done);

  useGSAP(
    () => {
      if (!done) return;

      SplitText.create(textRef.current, {
        type: "lines",
        mask: "lines",
        linesClass: "line",
        autoSplit: true, // 폰트 로드·리사이즈 시 자동 재분할
        onSplit(self) {
          const tween = gsap.from(self.lines, {
            yPercent: 100,
            duration: 2,
            stagger: 0.1,
            ease: "power4.out",
            delay: viaTransition.current
              ? DELAY_AFTER_TRANSITION
              : DELAY_AFTER_INTRO,
          });

          gsap.set(textRef.current, { visibility: "visible" });
          return tween;
        },
      });
    },
    { scope: container, dependencies: [done] },
  );

  return (
    <div className="info" ref={container}>
      <div className="col">
        <img src="/portrait.jpg" alt="" />
      </div>
      <div className="col">
        <p ref={textRef}>
          Kaelon is a portrait photographer who captures striking and artistic
          images. His work focuses on light, shadow, and movement, creating
          portraits that feel both modern and timeless. With a minimal and moody
          style, he brings out raw emotion and unique beauty in every subject.
        </p>
      </div>
    </div>
  );
};

export default Info;
