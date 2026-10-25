"use client";
/* 로그인 — 턴테이블 라벨형
   가운데 판이 33⅓ rpm 으로 돌고, 판 라벨이 곧 "Continue with Google" 버튼.
   - 라벨에 올리면 판이 45 rpm 으로 빨라지고 톤암이 판 쪽으로 다가옴
   - 누르면 바늘이 바깥 홈에 내려앉은 뒤 Google 로그인으로 이동 (처음이면 그 자리에서 계정이 만들어짐)
   - 로그인한 상태면 바늘이 판 위에 있고 라벨에 프로필 사진 → My collection / Log out
   ?next=/collection 처럼 넘어오면 로그인 후 그 페이지로 돌아감. ?error= 가 있으면 실패 안내
   글자는 모두 영어 (Bodoni 제목 + 본문 산세리프) */
import { MONOTON } from "@/lib/fonts";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import PageShell from "@/components/layout/PageShell";
import useAuthUser, { profileOf, signInWithGoogle, signOut } from "@/lib/useAuthUser";

const SERIF = "font-['Grooves_Display','Hahmlet',Georgia,serif] font-black tracking-[-0.01em]";
const EASE = "ease-[cubic-bezier(.45,0,.2,1)]";
const NEEDLE_MS = 950;        // 바늘이 내려앉는 시간 → 그다음 Google 로 이동
const RPM = { idle: 33.333, hover: 45, playing: 33.333, done: 33.333 };

// 홈: 첫 로딩 판과 같은 규칙 (바깥 → 안쪽, 끊긴 호, 굵기·농도 조금씩 다르게)
// [반지름, 시작 각도, 그려지는 비율, 굵기, 농도]
const GROOVES = [
  [166, -8, 0.996, 4.2, 1], [154, 74, 0.975, 2.1, 0.9], [142, 152, 0.94, 2.3, 1], [130, 35, 0.985, 2, 0.85],
  [118, 218, 0.95, 2.3, 1], [106, 112, 0.97, 2.1, 0.92], [94, 295, 0.93, 2.4, 1], [84, 176, 0.98, 2, 0.88],
];
const RIM = "GROOVES · SIDE A · 33⅓ RPM · LOG IN TO YOUR SHELF · ";

function GoogleMark({ className = "" }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 48 48" className={className}>
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

export default function AuthPanel() {
  const user = useAuthUser();                 // undefined = 확인 중
  const [next, setNext] = useState("/");
  const [error, setError] = useState(false);
  const [phase, setPhase] = useState("idle"); // idle → playing(바늘 내려감) → Google / done(로그인됨)
  const [hover, setHover] = useState(false);
  const spinRef = useRef(null);
  const live = useRef({ phase: "idle", hover: false });
  live.current = { phase: user ? "done" : phase, hover };

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const n = q.get("next");
    if (n && n.startsWith("/") && !n.startsWith("//")) setNext(n);
    if (q.get("error")) setError(true);
  }, []);

  // 판 회전 (속도는 부드럽게 따라감). 움직임 줄이기면 멈춰 있음
  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0, angle = 0, speed = 0, last = performance.now();
    const frame = (now) => {
      const dt = Math.min((now - last) / 1000, 0.05); last = now;
      const { phase: p, hover: h } = live.current;
      const goal = (h && p === "idle" ? RPM.hover : RPM[p]) * 6;      // rpm → 도/초
      speed += (goal - speed) * (1 - Math.exp(-dt / 0.6));
      angle = (angle + speed * dt) % 360;
      spinRef.current?.setAttribute("transform", `rotate(${angle.toFixed(2)} 200 200)`);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  const state = user ? "done" : phase;
  const p = profileOf(user);

  function drop() {
    if (state !== "idle" || user === undefined) return;
    setPhase("playing"); setHover(false); setError(false);
    const wait = matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : NEEDLE_MS;
    setTimeout(async () => {
      const { error: e } = await signInWithGoogle(next);   // 성공하면 Google 화면으로 넘어감
      if (e) { setError(true); setPhase("idle"); }
    }, wait);
  }

  const status = error ? "Couldn’t finish signing in. Tap the label to try again."
    : state === "playing" ? "Dropping the needle… heading to Google"
    : state === "done" ? p.email
    : "Tap the label to drop the needle";

  return (
    <PageShell className="paper-textured" footer={false}>
      <section className="flex min-h-[calc(100svh-var(--ct-header-h,106px))] w-full overflow-x-clip flex-col items-center justify-center gap-[clamp(18px,2.6vh,32px)] px-5 pb-12 pt-6 text-center font-['Hahmlet',Georgia,serif] text-(--ink)">
        <p className="text-[11px] font-medium uppercase tracking-[0.3em] opacity-60">Login</p>
        <h1 className={`${MONOTON} text-[clamp(30px,4.4vw,56px)] leading-[1.1]`}>
          {state === "done" ? <>Welcome back{p.name ? <>, <span className="whitespace-nowrap">{p.name.split(" ")[0]}</span></> : ""}</> : "Drop the needle"}
        </h1>

        {/* 턴테이블 */}
        <div data-state={state} data-hover={hover && state === "idle"}
          className="group/deck relative aspect-square w-[min(78vw,54vh,520px)] [--size:min(78vw,54vh,520px)]">
          <svg viewBox="0 0 400 400" aria-hidden="true" className="absolute inset-0 size-full overflow-visible">
            <defs><path id="login-rim" d="M200,200 m-178,0 a178,178 0 1,1 356,0 a178,178 0 1,1 -356,0" /></defs>
            <g ref={spinRef}>
              {GROOVES.map(([r, rot, len, w, o]) => (
                <circle key={r} cx="200" cy="200" r={r} fill="none" stroke="currentColor" strokeLinecap="round"
                  strokeWidth={w} opacity={o} pathLength="1" strokeDasharray={`${len} ${1 - len + 0.0001}`}
                  transform={`rotate(${rot} 200 200)`} />
              ))}
              <text className="fill-current text-[9px] font-medium tracking-[3.2px] opacity-55">
                <textPath href="#login-rim">{RIM + RIM}</textPath>
              </text>
            </g>
          </svg>
          {/* 반사광: 판은 돌아도 빛은 제자리 */}
          <span aria-hidden="true" className="pointer-events-none absolute inset-[9%] rounded-full opacity-45 mix-blend-soft-light"
            style={{
              background: "conic-gradient(from 20deg, transparent 0 8%, rgba(255,255,255,.9) 13%, transparent 19% 52%, rgba(255,255,255,.75) 60%, transparent 66%)",
              WebkitMask: "radial-gradient(circle, transparent 0 28%, #000 29% 70%, transparent 71%)",
              mask: "radial-gradient(circle, transparent 0 28%, #000 29% 70%, transparent 71%)",
            }} />

          {/* 톤암: 쉬는 자리(판 밖) → 라벨에 올리면 다가옴 → 누르면 바깥 홈에 내려앉음 */}
          <span aria-hidden="true"
            className={`pointer-events-none absolute -right-[9%] -top-[4%] h-[86%] w-[34%] origin-[74%_9%] rotate-[-12deg] transition-[rotate] duration-[950ms] ${EASE} group-data-[hover=true]/deck:rotate-[-6deg] group-data-[state=playing]/deck:rotate-[6deg] group-data-[state=done]/deck:rotate-[6deg] motion-reduce:transition-none`}>
            <svg viewBox="0 0 100 300" className="size-full overflow-visible">
              <circle cx="74" cy="27" r="13" fill="none" stroke="currentColor" strokeWidth="2.4" />
              <circle cx="74" cy="27" r="4" fill="currentColor" />
              <path d="M74 27 L74 210 Q74 236 52 258" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" />
              <rect x="38" y="252" width="22" height="30" rx="3" fill="currentColor" transform="rotate(38 49 267)" />
            </svg>
          </span>

          {/* 라벨 = 로그인 버튼 (로그인 상태면 내 컬렉션으로) */}
          {state === "done" ? (
            <Link href={next !== "/" ? next : "/collection"} aria-label="Open my collection"
              className="absolute left-1/2 top-1/2 grid aspect-square w-[36%] -translate-1/2 place-items-center rounded-full bg-[#bbcbda] text-[#4c404a] shadow-[0_0_0_calc(var(--size)*.008)_var(--ink),0_10px_30px_-12px_rgba(30,20,28,.45)] transition-[scale] duration-500 hover:scale-[1.035] focus-visible:outline-3 focus-visible:outline-offset-6 focus-visible:outline-(--accent)">
              <span className="grid justify-items-center gap-[calc(var(--size)*.014)]">
                {p.avatar
                  ? <img src={p.avatar} alt="" referrerPolicy="no-referrer" className="size-[calc(var(--size)*.11)] rounded-full object-cover" />
                  : <span className={`${SERIF} grid size-[calc(var(--size)*.11)] place-items-center rounded-full bg-[#4c404a] text-[calc(var(--size)*.05)] text-[#f4e7cd]`}>{(p.name || "G").slice(0, 1).toUpperCase()}</span>}
                <span className="text-[clamp(8px,calc(var(--size)*.019),10px)] uppercase tracking-[0.26em] opacity-60">Now playing · Your shelf</span>
              </span>
            </Link>
          ) : (
            <button type="button" onClick={drop} disabled={user === undefined}
              onPointerEnter={() => setHover(true)} onPointerLeave={() => setHover(false)} onFocus={() => setHover(true)} onBlur={() => setHover(false)}
              aria-label="Continue with Google"
              className="absolute left-1/2 top-1/2 grid aspect-square w-[36%] -translate-1/2 cursor-pointer place-items-center rounded-full bg-[#bbcbda] text-[#4c404a] shadow-[0_0_0_calc(var(--size)*.008)_var(--ink),0_10px_30px_-12px_rgba(30,20,28,.45)] transition-[scale] duration-500 ease-[cubic-bezier(.22,1,.36,1)] hover:scale-[1.035] active:scale-[.98] disabled:cursor-wait focus-visible:outline-3 focus-visible:outline-offset-6 focus-visible:outline-(--accent)">
              <span className="grid justify-items-center gap-[calc(var(--size)*.012)]">
                <span className="grid size-[calc(var(--size)*.075)] place-items-center rounded-full bg-white shadow-[0_1px_0_rgba(0,0,0,.08)]">
                  <GoogleMark className="size-[58%]" />
                </span>
                <span className="text-[clamp(11px,calc(var(--size)*.03),15px)] font-semibold tracking-[0.02em]">
                  {state === "playing" ? "Connecting…" : "Continue with Google"}
                </span>
                <span className="text-[clamp(8px,calc(var(--size)*.018),10px)] uppercase tracking-[0.26em] opacity-60">Side A · Login</span>
              </span>
            </button>
          )}
        </div>

        <p role="status" className={`min-h-[1.6em] text-[13px] tracking-[0.02em] ${error ? "text-(--danger)" : "opacity-75"}`}>{user === undefined ? "" : status}</p>

        {state === "done" ? (
          <div className="flex flex-wrap justify-center gap-2.5">
            <Link href={next !== "/" ? next : "/collection"} className="inline-flex min-h-12 items-center rounded-full bg-(--ink) px-7 text-[12px] font-medium uppercase tracking-[0.18em] text-(--cream) transition-colors hover:bg-(--accent)">
              {next !== "/" ? "Continue" : "My collection"}
            </Link>
            <button type="button" onClick={() => { setPhase("idle"); signOut(); }}
              className="inline-flex min-h-12 items-center rounded-full border border-(--ink) px-7 text-[12px] font-medium uppercase tracking-[0.18em] transition-colors hover:bg-(--ink) hover:text-(--cream)">
              Log out
            </button>
          </div>
        ) : (
          <p className="max-w-[38ch] text-[12px] leading-6 opacity-60">
            First time here? Your shelf is set up automatically.<br />We only receive your name, email and profile photo.<br />
            By continuing you agree to our <Link href="/terms" className="relative underline underline-offset-4 before:absolute before:-inset-x-1 before:-inset-y-3.5 before:content-[''] hover:opacity-100">Terms</Link> and <Link href="/privacy" className="relative underline underline-offset-4 before:absolute before:-inset-x-1 before:-inset-y-3.5 before:content-[''] hover:opacity-100">Privacy Policy</Link>.
          </p>
        )}
      </section>
    </PageShell>
  );
}
