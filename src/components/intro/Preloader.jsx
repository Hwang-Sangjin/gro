"use client";

import { useEffect, useRef, useState } from "react";

import gsap from "gsap";
import { useGSAP } from "@gsap/react";

import { useIntro } from "./intro-context";
import { useAppReady } from "./useAppReady";

gsap.registerPlugin(useGSAP);

// ── 타이밍 ────────────────────────────────────────────────────
//
//  생성 : 0.00 홈 새기기(돌면서) / 0.25 회전 가속 / 1.00 스핀들 / 1.45 라벨
//  대기 : 최소 0.8s (로딩이 끝날 때까지 계속 회전)
//  아웃 : 0.00 감속 · 살짝 물러남 → 0.40 줌인 → 덮이는 순간 자동 핸드오프
//
const T = {
  // ── 생성 ──
  inkRatio: 0.75, // 잉크가 배어드는 구간. 길수록 선이 은은하게 떠오른다
  spindleAt: 1.0,
  spindleIn: 0.5,
  labelAt: 1.45, // 홈이 다 새겨질 즈음 라벨이 붙는다
  label: 0.7,
  birthScale: 1, // 0.94 등으로 낮추면 판 전체가 부풀며 등장한다
  birth: 1.6,
  // ── 회전 ──
  spinAt: 0.25, // 홈을 새기는 동안 이미 판이 돌기 시작한다
  spinUp: 1.5, // 정지 → 33⅓ RPM 가속
  minSpin: 0.8, // 로딩이 즉시 끝나도 최소 이만큼은 돈다
  // ── 아웃 ──
  decel: 1.0,
  decelTo: 0.25, // 줌 중에도 남겨둘 회전 속도 (0이면 완전 정지)
  anticipate: 0.4, // 파고들기 전 살짝 물러나는 시간
  anticipateScale: 0.965,
  zoomStart: 0.4,
  zoom: 0.8, // 실제로 파고드는 시간. 짧을수록 빠르다
  strokeFadeAt: 0.15, // 줌 진행률 이 시점부터 홈이 사라지기 시작
  strokeFade: 0.5, // 줌 대비 페이드 길이 비율
  curtain: 0.35,
  overshoot: 1.6, // 화면을 덮고도 더 파고드는 여유배율
};

const RPM = 33 + 1 / 3;
const REV = 60 / RPM; // 1.8s / 회전

const VB = 400; // viewBox 한 변
const C = VB / 2; // 중심
const ORIGIN = `${C} ${C}`; // 모든 변형의 기준점

const LABEL_R = 34; // 가운데 하늘색 라벨 반지름 (Home 3D 판의 라벨과 같은 색)
const SPINDLE_R = 5;

// 바깥 → 안쪽. 12 씩 등간격.
// r: 반지름 / rot: 시작점 각도 / len: 그려지는 비율(1이면 완전히 닫힘)
// w: 선 굵기 / o: 잉크 농도 / at: 긋기 시작하는 시점 / dur: 긋는 속도
//
// at 간격이 일정하면 메트로놈처럼 딱딱 끊겨 들린다.
// 0.06 ~ 0.11 사이로 불규칙하게 흩고, dur 은 간격보다 훨씬 길게 잡아
// 항상 대여섯 줄이 동시에 그어지고 있게 한다.
const GROOVES = [
  { r: 150, rot: -8, len: 1.0, w: 4, o: 1, at: 0, dur: 1.25 },
  { r: 138, rot: 74, len: 0.975, w: 2.1, o: 0.9, at: 0.09, dur: 1.05 },
  { r: 126, rot: 152, len: 0.94, w: 2.3, o: 1, at: 0.16, dur: 1.15 },
  { r: 114, rot: 35, len: 0.985, w: 2.0, o: 0.85, at: 0.27, dur: 0.95 },
  { r: 102, rot: 218, len: 0.95, w: 2.3, o: 1, at: 0.33, dur: 1.1 },
  { r: 90, rot: 112, len: 0.97, w: 2.1, o: 0.92, at: 0.44, dur: 1.0 },
  { r: 78, rot: 295, len: 0.93, w: 2.4, o: 1, at: 0.52, dur: 1.15 },
  { r: 66, rot: 176, len: 0.98, w: 2.0, o: 0.88, at: 0.61, dur: 0.9 },
  { r: 54, rot: 60, len: 0.945, w: 2.2, o: 1, at: 0.72, dur: 1.05 },
];

// 라벨 테두리. 홈과 같은 규칙을 따르되 마지막에 그려진다.
const RING = { r: LABEL_R, rot: -90, len: 1.0, w: 4, o: 1, dur: 0.7 };

const finalOpacity = (i, el) => parseFloat(el.dataset.o);

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

  // 1. 바이닐 생성 (판은 새겨지는 동안 이미 돌고 있다)
  useGSAP(
    () => {
      reduced.current = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;

      const ring = overlay.current.querySelector("[data-ring]");
      const grooves = gsap.utils.toArray("[data-groove]", overlay.current);
      const strokes = [...grooves, ring];

      // 변형을 쓰는 그룹은 기준점을 한 번만 확정해둔다.
      // (tween 마다 svgOrigin 을 넘기면 매번 CTM 을 다시 재서 어긋날 수 있다)
      gsap.set([zoom.current, birth.current, disc.current], {
        svgOrigin: ORIGIN,
      });

      // dasharray 갭 2 = 나머지 경로를 확실히 숨김
      strokes.forEach((el) => {
        const len = parseFloat(el.dataset.len);
        gsap.set(el, {
          strokeDasharray: `${len} 2`,
          strokeDashoffset: len,
          opacity: 0,
        });
      });

      if (reduced.current) {
        gsap.set(strokes, { strokeDashoffset: 0, opacity: finalOpacity });
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

      const tl = gsap.timeline({ onComplete: () => setPhase("hold") });

      // ① 홈이 바깥에서 안쪽으로 새겨진다.
      //    줄마다 시작 시점과 속도가 달라서 시작 지점이 박자로 들리지 않는다.
      grooves.forEach((el) => {
        const at = parseFloat(el.dataset.at);
        const dur = parseFloat(el.dataset.dur);
        const o = parseFloat(el.dataset.o);

        // 획: 처음부터 쭉 뻗어나간다. inOut 으로 하면 시작점에서
        // round cap 이 점처럼 맺혀 있다가 움직여서 "톡" 하고 나타난다.
        tl.to(
          el,
          { strokeDashoffset: 0, duration: dur, ease: "power2.out" },
          at,
        );

        // 잉크: 0 에서 기울기 0 으로 천천히 올라온다.
        // 선은 이미 길어져 있는데 아직 흐려서, 떠오르듯 드러난다.
        tl.to(
          el,
          { opacity: o, duration: dur * T.inkRatio, ease: "power1.in" },
          at,
        );
      });

      tl
        // ② 판은 새겨지는 도중에 이미 돌기 시작한다
        .to(
          spin.current,
          { timeScale: 1, duration: T.spinUp, ease: "power1.inOut" },
          T.spinAt,
        )
        // ③ 판 전체의 미세한 부풀림 (birthScale 이 1 이면 아무 일도 하지 않는다)
        .fromTo(
          birth.current,
          { scale: T.birthScale },
          { scale: 1, duration: T.birth, ease: "power2.out" },
          0,
        )
        // ④ 스핀들이 조용히 맺힌다
        .fromTo(
          spindle.current,
          { opacity: 0 },
          { opacity: 1, duration: T.spindleIn, ease: "power1.out" },
          T.spindleAt,
        )
        // ⑤ 크림 라벨이 중심에서 번지고, 테두리가 마지막 획으로 닫는다
        .fromTo(
          label.current,
          { attr: { r: 0 }, opacity: 0 },
          {
            attr: { r: LABEL_R },
            opacity: 1,
            duration: T.label,
            ease: "power2.out",
          },
          T.labelAt,
        )
        .to(
          ring,
          { strokeDashoffset: 0, duration: RING.dur, ease: "power2.out" },
          T.labelAt,
        )
        .to(
          ring,
          {
            opacity: RING.o,
            duration: RING.dur * T.inkRatio,
            ease: "power1.in",
          },
          T.labelAt,
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

      let handed = false;
      const handoff = () => {
        if (handed) return;
        handed = true;
        spin.current?.kill();
        finish();
        gsap.to(overlay.current, {
          autoAlpha: 0,
          duration: T.curtain,
          ease: "power1.out",
          onComplete: () => setPhase("gone"),
        });
      };

      if (reduced.current) {
        handoff();
        return;
      }

      gsap.set(zoom.current, { svgOrigin: ORIGIN });

      // 라벨 원이 뷰포트를 덮는 데 필요한 배율을 실측으로 계산
      const box = svg.current.getBoundingClientRect();
      const unit = Math.min(box.width, box.height) / VB; // 1 user unit 당 px
      const renderedR = LABEL_R * unit;
      const cover =
        Math.hypot(window.innerWidth, window.innerHeight) / 2 / renderedR;
      const target = cover * T.overshoot;

      // 배율을 선형으로 키우면 눈에는 "처음엔 빠르고 끝에서 멈추는" 것처럼 보인다.
      // 사람이 느끼는 확대 속도는 배율의 로그에 비례하므로, 로그 공간에서 보간한다.
      const from = T.anticipateScale;
      const span = Math.log(target / from);
      const p = { v: 0 };

      const strokes = gsap.utils.toArray(
        "[data-groove], [data-ring]",
        overlay.current,
      );

      gsap
        .timeline()
        // 완전히 멈추지 않는다. 파고드는 동안에도 판은 천천히 돈다.
        .to(
          spin.current,
          { timeScale: T.decelTo, duration: T.decel, ease: "power2.out" },
          0,
        )
        // 파고들기 직전, 숨을 들이쉬듯 아주 살짝 물러난다
        .to(
          zoom.current,
          {
            scale: T.anticipateScale,
            duration: T.anticipate,
            ease: "power2.out",
          },
          0,
        )
        .to(spindle.current, { opacity: 0, duration: 0.45 }, T.zoomStart)
        // 로그 공간 줌
        .to(
          p,
          {
            v: 1,
            duration: T.zoom,
            ease: "power1.inOut",
            onUpdate() {
              const s = from * Math.exp(span * p.v);
              gsap.set(zoom.current, { scale: s });
              // 화면이 덮이는 순간을 계산이 아니라 실제 배율로 감지한다
              if (s >= cover) handoff();
            },
            onComplete: handoff, // 안전장치
          },
          T.zoomStart,
        )
        // 지나쳐 간 홈은 흐려진다. 화면 밖 거대한 호를 계속 그리지 않게 하는 역할도 한다
        .to(
          strokes,
          {
            opacity: 0,
            duration: T.zoom * T.strokeFade,
            ease: "power2.in",
          },
          T.zoomStart + T.zoom * T.strokeFadeAt,
        );
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
              {GROOVES.map((g) => (
                <circle
                  key={g.r}
                  data-groove
                  data-len={g.len}
                  data-o={g.o}
                  data-at={g.at}
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
                data-len={RING.len}
                data-o={RING.o}
                data-dur={RING.dur}
                cx={C}
                cy={C}
                r={RING.r}
                strokeWidth={RING.w}
                pathLength="1"
                transform={`rotate(${RING.rot} ${C} ${C})`}
              />
            </g>
            <circle
              ref={spindle}
              className="preloader-spindle"
              cx={C}
              cy={C}
              r={SPINDLE_R}
            />
          </g>
        </g>
      </svg>
    </div>
  );
}
