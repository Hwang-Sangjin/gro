"use client";

import { useEffect, useRef, useState } from "react";

import gsap from "gsap";
import { useGSAP } from "@gsap/react";

import { useIntro } from "./intro-context";
import { useAppReady } from "./useAppReady";

gsap.registerPlugin(useGSAP);

// ── 타이밍 (여기만 만지면 전체 호흡이 바뀝니다) ───────────────────
//
//  생성 : 0.00 스핀들 → 0.10 테두리 → 0.45 홈 → 1.25 라벨 → 1.35 회전
//  대기 : 최소 0.8s (로딩이 끝날 때까지 계속 회전)
//  아웃 : 0.00 감속 → 0.45 줌인 → 1.57 홈으로 핸드오프
//
const T = {
  // ── 생성 ──
  birthScale: 0.94, // 판 전체가 미세하게 부풀며 자리잡는 시작 배율
  birth: 1.4,
  spindleIn: 0.45,
  edgeAt: 0.1, // 바깥 테두리가 한 바퀴 도는 시점
  edge: 0.9,
  drawAt: 0.45, // 홈이 새겨지기 시작하는 시점
  drawStagger: 0.055,
  labelAt: 1.25, // 크림 라벨이 붙는 시점
  label: 0.6,
  // ── 회전 ──
  spinAt: 1.35,
  spinUp: 1.1, // 정지 → 33⅓ RPM 가속
  minSpin: 0.8, // 로딩이 즉시 끝나도 최소 이만큼은 돈다
  // ── 아웃 ──
  decel: 0.9,
  decelTo: 0.15, // 줌 중에도 남겨둘 회전 속도 (0이면 완전 정지)
  zoomStart: 0.45, // 감속이 끝나기 전에 줌을 겹쳐 시작
  zoom: 1.4,
  handoffAt: 0.8, // 줌 진행률 이 시점에 홈으로 넘김
  curtain: 0.3,
  overshoot: 1.6, // 화면을 덮고도 더 파고드는 여유배율
};

const RPM = 33 + 1 / 3;
const REV = 60 / RPM; // 1.8s / 회전

const VB = 400; // viewBox 한 변
const C = VB / 2; // 중심
const ORIGIN = `${C} ${C}`; // 모든 변형의 기준점

const LABEL_R = 66; // 가운데 크림색 원 반지름
const SPINDLE_R = 5;

// 판의 바깥 테두리. 제일 먼저, 한 바퀴 돌듯 그려진다.
const EDGE = { r: 182, len: 1.0, w: 4.0 };

// 홈. 바깥에서 안쪽으로 새겨진다.
// len: 그려지는 비율(1 미만이면 열린 호) / w: 필압 / dur: 속도 / rot: 시작 각도
const GROOVES = [
  { r: 170, len: 0.93, w: 1.6, dur: 0.85, rot: 40 },
  { r: 159, len: 0.88, w: 2.2, dur: 0.75, rot: 150 },
  { r: 149, len: 0.96, w: 1.4, dur: 0.9, rot: -20 },
  { r: 137, len: 0.9, w: 2.0, dur: 0.8, rot: 95 },
  { r: 126, len: 0.85, w: 1.5, dur: 0.7, rot: 200 },
  { r: 114, len: 0.94, w: 2.4, dur: 0.85, rot: 10 },
  { r: 101, len: 0.89, w: 1.6, dur: 0.75, rot: 125 },
  { r: 88, len: 0.92, w: 2.0, dur: 0.8, rot: 245 },
];

export default function Preloader() {
  const { finish } = useIntro();
  const ready = useAppReady();

  // birth → hold(로딩 대기) → out(감속·줌인) → gone
  const [phase, setPhase] = useState("birth");

  const overlay = useRef(null);
  const svg = useRef(null);
  const zoom = useRef(null); // 아웃 단계의 확대만 담당
  const birth = useRef(null); // 생성 단계의 미세 확대만 담당
  const disc = useRef(null); // 회전만 담당
  const label = useRef(null);
  const spindle = useRef(null);
  const spin = useRef(null);
  const reduced = useRef(false);

  // 1. 바이닐 생성 → 회전 가속
  useGSAP(
    () => {
      reduced.current = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;

      const edge = overlay.current.querySelector("[data-edge]");
      const ring = overlay.current.querySelector("[data-ring]");
      const grooves = gsap.utils.toArray("[data-groove]", overlay.current);
      const strokes = [edge, ...grooves, ring];

      // 변형을 쓰는 그룹은 기준점을 한 번만 확정해둔다.
      // (tween 마다 svgOrigin 을 넘기면 매번 CTM 을 다시 재서 어긋날 수 있다)
      gsap.set([zoom.current, birth.current, disc.current], {
        svgOrigin: ORIGIN,
      });

      // dasharray 갭 2 = 나머지 경로를 확실히 숨김
      strokes.forEach((el) => {
        const len = parseFloat(el.dataset.len);
        gsap.set(el, { strokeDasharray: `${len} 2`, strokeDashoffset: len });
      });

      if (reduced.current) {
        gsap.set(strokes, { strokeDashoffset: 0 });
        gsap.set(label.current, { attr: { r: LABEL_R }, opacity: 1 });
        gsap.set(spindle.current, { attr: { r: SPINDLE_R }, opacity: 1 });
        setPhase("hold");
        return;
      }

      spin.current = gsap.to(disc.current, {
        rotation: 360,
        duration: REV,
        ease: "none",
        repeat: -1,
      });
      spin.current.timeScale(0);

      gsap
        .timeline({ onComplete: () => setPhase("hold") })
        // ① 중심에 스핀들 점이 먼저 찍힌다 (scale 대신 반지름을 키운다)
        .fromTo(
          spindle.current,
          { attr: { r: 0 }, opacity: 0 },
          {
            attr: { r: SPINDLE_R },
            opacity: 1,
            duration: T.spindleIn,
            ease: "back.out(2.5)",
          },
          0,
        )
        // ② 판 전체가 미세하게 부풀며 자리잡는다
        .fromTo(
          birth.current,
          { scale: T.birthScale },
          { scale: 1, duration: T.birth, ease: "power3.out" },
          0,
        )
        // ③ 바깥 테두리가 한 바퀴 돌며 판의 경계를 만든다
        .to(
          edge,
          { strokeDashoffset: 0, duration: T.edge, ease: "power2.inOut" },
          T.edgeAt,
        )
        // ④ 홈이 바깥에서 안쪽으로 새겨진다
        .to(
          grooves,
          {
            strokeDashoffset: 0,
            duration: (i, el) => parseFloat(el.dataset.dur),
            stagger: T.drawStagger,
            ease: "power2.out",
          },
          T.drawAt,
        )
        // ⑤ 크림 라벨이 중심에서 붙는다 (역시 반지름으로)
        .fromTo(
          label.current,
          { attr: { r: 0 }, opacity: 0 },
          {
            attr: { r: LABEL_R },
            opacity: 1,
            duration: T.label,
            ease: "power3.out",
          },
          T.labelAt,
        )
        .to(
          ring,
          { strokeDashoffset: 0, duration: T.label, ease: "power2.out" },
          T.labelAt,
        )
        // ⑥ 판이 돌기 시작한다
        .to(
          spin.current,
          { timeScale: 1, duration: T.spinUp, ease: "power1.in" },
          T.spinAt,
        )
        .to({}, { duration: T.minSpin });
    },
    { scope: overlay },
  );

  // 2. 리소스까지 준비되면 아웃 단계로
  useEffect(() => {
    if (phase === "hold" && ready) setPhase("out");
  }, [phase, ready]);

  // 3. 감속 → 라벨 원으로 줌인 → 홈으로 핸드오프
  useGSAP(
    () => {
      if (phase !== "out") return;

      if (reduced.current) {
        finish();
        gsap.to(overlay.current, {
          autoAlpha: 0,
          duration: 0.3,
          onComplete: () => setPhase("gone"),
        });
        return;
      }

      // 라벨 원이 뷰포트를 덮는 데 필요한 배율을 실측으로 계산
      const box = svg.current.getBoundingClientRect();
      const unit = Math.min(box.width, box.height) / VB; // 1 user unit 당 px
      const renderedR = LABEL_R * unit;

      // 화면 중앙에서 가장 먼 모서리까지의 거리
      const cover =
        Math.hypot(window.innerWidth, window.innerHeight) / 2 / renderedR;
      const target = cover * T.overshoot;

      const handoff = T.zoomStart + T.zoom * T.handoffAt;

      gsap
        .timeline()
        // 완전히 멈추지 않는다. 파고드는 동안에도 판은 천천히 돈다.
        .to(
          spin.current,
          { timeScale: T.decelTo, duration: T.decel, ease: "power2.out" },
          0,
        )
        .to(spindle.current, { opacity: 0, duration: 0.4 }, T.zoomStart)
        .to(
          zoom.current,
          { scale: target, duration: T.zoom, ease: "power2.in" },
          T.zoomStart,
        )
        .call(
          () => {
            spin.current?.kill();
            finish();
          },
          null,
          handoff,
        )
        .to(overlay.current, { autoAlpha: 0, duration: T.curtain }, handoff)
        .call(() => setPhase("gone"));
    },
    { scope: overlay, dependencies: [phase] },
  );

  if (phase === "gone") return null;

  return (
    <div className="preloader" ref={overlay} aria-hidden="true">
      <svg
        className="preloader-disc"
        ref={svg}
        viewBox={`0 0 ${VB} ${VB}`}
        preserveAspectRatio="xMidYMid meet"
      >
        <g ref={zoom}>
          <g ref={birth}>
            <g ref={disc}>
              <circle
                data-edge
                data-len={EDGE.len}
                cx={C}
                cy={C}
                r={EDGE.r}
                strokeWidth={EDGE.w}
                pathLength="1"
                transform={`rotate(-90 ${C} ${C})`}
              />
              {GROOVES.map((g) => (
                <circle
                  key={g.r}
                  data-groove
                  data-len={g.len}
                  data-dur={g.dur}
                  cx={C}
                  cy={C}
                  r={g.r}
                  strokeWidth={g.w}
                  pathLength="1"
                  transform={`rotate(${g.rot} ${C} ${C})`}
                />
              ))}
              {/* 반지름을 0 에서 키우므로 초기값도 0 */}
              <circle
                className="preloader-label"
                ref={label}
                cx={C}
                cy={C}
                r="0"
              />
              <circle
                data-ring
                data-len="1"
                cx={C}
                cy={C}
                r={LABEL_R}
                strokeWidth="4"
                pathLength="1"
                transform={`rotate(-90 ${C} ${C})`}
              />
            </g>
            <circle
              ref={spindle}
              className="preloader-spindle"
              cx={C}
              cy={C}
              r="0"
            />
          </g>
        </g>
      </svg>
    </div>
  );
}
