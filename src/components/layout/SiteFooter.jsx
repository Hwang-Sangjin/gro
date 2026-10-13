"use client";
// 사이트 공통 Footer = "상자의 마지막 판" — PageShell 맨 아래 (footer={false} 로 끌 수 있음)
// - 맨 아래로 내려오면: 상자(앞판에 GROOVES 도장) 뒤에서 마지막 슬리브가 올라오며 앞으로 기울어 서고,
//   그 뒷면에 링크가 적혀 있음. 끝에 가까워지면 판(Side B)이 슬리브 위로 빠져나와 돔
// - "Flip to Side A": 판이 화면 가득 커지며 뒤집히고(B → A), 그 순간 맨 위로 이동한 뒤 판이 작아지며 사라짐
// - 진행도는 리렌더 없이 CSS 변수 --fp (0: Footer 윗변이 화면 바닥에 닿음 → 1: 페이지 끝)
// - 움직임 줄이기: 슬리브·판은 다 올라온 상태로 고정, Flip 은 바로 맨 위로
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { NAV } from "@/components/crate/routes";
import useAuthUser from "@/lib/useAuthUser";
import { SITE } from "@/lib/site";

const SERIF = "font-['Grooves_Bodoni',Georgia,serif] font-black tracking-[-0.035em]";
const HEAD = "text-[11px] font-medium uppercase tracking-[0.26em] text-(--cream)/55";
const LINK = "group/l inline-flex items-center py-1 text-[15px] text-(--cream)/85 transition-colors hover:text-(--cream)";
// --fp 의 a~b 구간을 0~1 로
const seg = (a, b) => `clamp(0, (var(--fp, 1) - ${a}) / ${b - a}, 1)`;
const EASE = [0.65, 0, 0.35, 1];
// 슬리브 윗변 가운데 반달 홈 (손가락 걸이) — 배경색과 상관없이 뚫려 보이게 마스크로
const NOTCH = "radial-gradient(ellipse clamp(46px, 6vw, 80px) 22px at 50% 0, transparent 97%, #000 100%)";

function FootLink({ href, children }) {
  const Tag = href.startsWith("mailto:") ? "a" : Link;
  return (
    <Tag href={href} className={LINK}>
      <span className="h-px w-0 bg-current transition-[width,margin] duration-300 group-hover/l:mr-2 group-hover/l:w-3" />
      {children}
    </Tag>
  );
}

// 판 한 면 (홈 + 라벨). side 글자가 라벨에 찍힘
function DiscFace({ side, label = "#bbcbda", className = "" }) {
  return (
    <svg viewBox="0 0 200 200" className={className} aria-hidden="true">
      <circle cx="100" cy="100" r="99" fill="#1b1619" />
      {Array.from({ length: 20 }, (_, i) => (
        <circle key={i} cx="100" cy="100" r={95 - i * 3.2} fill="none" stroke="#f4e7cd" strokeWidth={i % 6 === 0 ? 0.9 : 0.45} opacity={i % 6 === 3 ? 0.05 : 0.15} />
      ))}
      <path d="M100 5a95 95 0 0 1 82 47" fill="none" stroke="#fff" strokeWidth="12" opacity=".05" />
      <circle cx="100" cy="100" r="32" fill={label} />
      <text x="100" y="92" textAnchor="middle" fontSize="6" fontWeight="700" letterSpacing="1.6" fill="#2a222a">GROOVES</text>
      <text x="100" y="114" textAnchor="middle" fontSize="11" fontWeight="900" letterSpacing="1" fill="#2a222a" fontFamily="Grooves Bodoni, Georgia, serif">SIDE {side}</text>
      <circle cx="100" cy="100" r="2.6" fill="#1b1619" />
    </svg>
  );
}

// 뒤집히는 판 (body 에 붙여서 페이지 변형·스크롤과 상관없이 화면 위에 뜸)
function FlipOverlay({ from, onCovered, onDone }) {
  const wrap = useRef(null), spin = useRef(null), faceB = useRef(null), faceA = useRef(null);
  useEffect(() => {
    if (!spin.current) return;
    const vw = innerWidth, vh = innerHeight, size = from.width, D = 1500;
    const cx = vw / 2 - size / 2, cy = vh / 2 - size / 2;
    const cover = (Math.hypot(vw, vh) / size) * 1.06;            // 판(원)이 화면 대각선을 덮는 배율
    const at = (x, y, s, ry, rz = 0) => `translate3d(${x}px, ${y}px, 0) perspective(1800px) rotateY(${ry}deg) rotateZ(${rz}deg) scale(${s})`;
    const opts = { duration: D, easing: `cubic-bezier(${EASE})`, fill: "forwards" };
    const anims = [
      spin.current.animate([
        { transform: at(from.x, from.y, 1, 0), offset: 0 },
        { transform: at(cx, cy, cover * 0.55, 90, 40), offset: 0.28 },
        { transform: at(cx, cy, cover, 180, 80), offset: 0.48 },
        { transform: at(cx, cy, cover, 180, 96), offset: 0.58 },
        { transform: at(cx, cy, 0.18, 180, 260), offset: 0.92 },
        { transform: at(cx, cy, 0.05, 180, 300), offset: 1 },
      ], opts),
      // 판이 옆으로 선 순간(90°) 앞면 B → 뒷면 A 로 바꿔 끼움 (뒷면 그림은 미리 좌우 반전)
      faceB.current.animate([{ opacity: 1 }, { opacity: 1, offset: 0.279 }, { opacity: 0, offset: 0.28 }, { opacity: 0 }], opts),
      faceA.current.animate([{ opacity: 0 }, { opacity: 0, offset: 0.279 }, { opacity: 1, offset: 0.28 }, { opacity: 1 }], opts),
      // 사라짐은 바깥 상자에서 (3D 상자에 투명도를 주면 평면으로 눌림)
      wrap.current.animate([{ opacity: 1 }, { opacity: 1, offset: 0.9 }, { opacity: 0 }], opts),
    ];
    const t = setTimeout(onCovered, D * 0.5);                     // 화면을 다 덮은 순간 맨 위로
    anims[0].onfinish = onDone;
    return () => { clearTimeout(t); anims.forEach((a) => a.cancel()); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from]);

  return createPortal(
    <div ref={wrap} aria-hidden="true" className="pointer-events-none fixed inset-0 z-[9998]">
      <div ref={spin} className="absolute left-0 top-0 will-change-transform" style={{ width: from.width, height: from.width }}>
        <div ref={faceB} className="absolute inset-0"><DiscFace side="B" className="size-full" /></div>
        <div ref={faceA} className="absolute inset-0 -scale-x-100 opacity-0"><DiscFace side="A" label="#e3b04b" className="size-full" /></div>
      </div>
    </div>,
    document.body,
  );
}

export default function SiteFooter() {
  const user = useAuthUser();
  const year = new Date(`${SITE.legalUpdated}T12:00:00+09:00`).getFullYear();
  const root = useRef(null);
  const disc = useRef(null);
  const [flip, setFlip] = useState(null);       // { x, y, width } — 뒤집는 중

  // 스크롤 진행도 → --fp, 화면에 있을 때만 판이 돎
  useEffect(() => {
    const el = root.current;
    const scroller = el?.closest(".page");
    if (!el || !scroller) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) { el.style.setProperty("--fp", "1"); return; }
    let raf = 0;
    const measure = () => {
      raf = 0;
      const box = el.getBoundingClientRect(), view = scroller.getBoundingClientRect();
      const top = box.top - view.top, vh = scroller.clientHeight;
      const p = Math.min(1, Math.max(0, (vh - top) / Math.max(1, box.height)));
      el.style.setProperty("--fp", p.toFixed(4));
      el.dataset.spin = p > 0.55 ? "on" : "off";
    };
    const queue = () => { if (!raf) raf = requestAnimationFrame(measure); };
    scroller.addEventListener("scroll", queue, { passive: true });
    addEventListener("resize", queue);
    measure();
    return () => { scroller.removeEventListener("scroll", queue); removeEventListener("resize", queue); cancelAnimationFrame(raf); };
  }, []);

  const flipToA = () => {
    const scroller = root.current?.closest(".page");
    if (!scroller) return;
    const box = disc.current?.getBoundingClientRect();
    if (!box || matchMedia("(prefers-reduced-motion: reduce)").matches) { scroller.scrollTo({ top: 0 }); return; }
    setFlip({ x: box.left, y: box.top, width: box.width });
  };
  const covered = () => root.current?.closest(".page")?.scrollTo({ top: 0, behavior: "instant" });
  const done = () => setFlip(null);

  return (
    <footer ref={root} data-spin="off" style={{ "--fp": 0, "--crate-h": "clamp(104px, 17vw, 270px)" }}
      className="site-footer group/footer relative isolate mt-auto overflow-hidden pt-[clamp(7rem,16vw,15rem)] text-(--ink) [perspective:1600px]">

      {/* 상자 안 다른 판들의 윗부분 (마지막 판이 올라오면 그 앞을 가림) */}
      <div aria-hidden="true" className="absolute inset-x-0 bottom-[var(--crate-h)] -z-10 mx-auto flex h-[clamp(3rem,6vw,5rem)] max-w-[1500px] items-end gap-[1.5%] px-[clamp(28px,5vw,90px)]">
        {[["#c8553d", 92, 0], ["#4f6d93", 70, 3], ["#e3b04b", 100, -2], ["#bbcbda", 80, 2], ["#8a5a3c", 64, -3]].map(([c, h, r], i) => (
          <span key={i} className="flex-1 rounded-t-[3px]" style={{ backgroundColor: c, height: `${h}%`, rotate: `${r}deg` }} />
        ))}
      </div>

      <div className="relative mx-auto max-w-[1500px] px-[clamp(16px,3vw,56px)]">
        {/* 마지막 슬리브: 상자 안에 잠겨 뒤로 누워 있다가 → 올라오며 앞으로 섬 */}
        <div className="relative origin-bottom will-change-transform"
          style={{ transform: `translateY(calc((1 - ${seg(0, 0.75)}) * 34%)) rotateX(calc((1 - ${seg(0, 0.75)}) * 16deg))` }}>
          {/* 슬리브에서 위로 빠져나오는 판 (Side B) */}
          <div ref={disc} aria-hidden="true" data-flipping={!!flip}
            className="absolute right-[clamp(28px,8vw,140px)] top-0 -z-10 aspect-square w-[min(44vw,400px)] data-[flipping=true]:opacity-0"
            style={{ transform: `translateY(calc(${seg(0.5, 1)} * -58%))` }}>
            <DiscFace side="B" className="size-full animate-[spin_1.8s_linear_infinite] [animation-play-state:paused] group-data-[spin=on]/footer:[animation-play-state:running] motion-reduce:animate-none" />
          </div>

          <div style={{ WebkitMask: NOTCH, mask: NOTCH }} className="relative rounded-t-[10px] bg-(--ink) px-[clamp(20px,4vw,72px)] pb-[calc(var(--crate-h)+clamp(1.5rem,3vw,2.5rem))] pt-[clamp(2.75rem,6vw,5rem)] text-(--cream) shadow-[0_-30px_60px_-30px_rgba(0,0,0,.45)]">
            <p aria-hidden="true" className="absolute left-[clamp(20px,4vw,72px)] top-4 text-[10px] uppercase tracking-[0.3em] text-(--cream)/45 tabular-nums">Side B · The end</p>

            <div className="grid grid-cols-2 gap-x-6 gap-y-10 md:grid-cols-[minmax(0,1.3fr)_repeat(3,minmax(0,1fr))] md:gap-8">
              <div className="col-span-2 md:col-span-1">
                <p className={`${SERIF} text-[clamp(2rem,3.4vw,3.2rem)] leading-[0.95]`}>Slow down.<br />Listen closer.</p>
                <p className="mt-5 max-w-[32ch] text-[14px] leading-6 text-(--cream)/65">{SITE.tagline}</p>
              </div>
              <nav aria-label="Explore">
                <p className={HEAD}>Explore</p>
                <ul className="mt-4 grid">{NAV.map((item) => <li key={item.href}><FootLink href={item.href}>{item.label}</FootLink></li>)}</ul>
              </nav>
              <nav aria-label="You">
                <p className={HEAD}>You</p>
                <ul className="mt-4 grid">
                  {user ? (
                    <>
                      <li><FootLink href="/collection">My collection</FootLink></li>
                      <li><FootLink href="/account">Account</FootLink></li>
                    </>
                  ) : <li><FootLink href="/login">Log in</FootLink></li>}
                  <li><FootLink href={`mailto:${SITE.email}`}>Contact</FootLink></li>
                </ul>
              </nav>
              <nav aria-label="Legal">
                <p className={HEAD}>Legal</p>
                <ul className="mt-4 grid">
                  <li><FootLink href="/privacy">Privacy Policy</FootLink></li>
                  <li><FootLink href="/terms">Terms of Service</FootLink></li>
                </ul>
              </nav>
            </div>

            <div className="mt-[clamp(2.5rem,6vw,4.5rem)] flex flex-wrap items-center justify-between gap-4 border-t border-(--cream)/20 pt-5 text-[11px] uppercase tracking-[0.22em] text-(--cream)/60">
              <p className="tabular-nums">© {year} {SITE.name} · {SITE.city}</p>
              <button type="button" onClick={flipToA} disabled={!!flip}
                className="group/t inline-flex min-h-11 items-center gap-3 rounded-full border border-(--cream)/30 py-1 pl-5 pr-1.5 text-(--cream) transition-colors hover:border-(--cream) hover:bg-(--cream) hover:text-(--ink)">
                Flip to Side A
                <span aria-hidden="true" className="grid size-8 place-items-center rounded-full bg-(--cream) text-(--ink) transition-transform duration-500 [transform-style:preserve-3d] group-hover/t:[transform:rotateY(180deg)] group-hover/t:bg-(--ink) group-hover/t:text-(--cream)">
                  <svg viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M8 13V3M4 7l4-4 4 4" /></svg>
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 상자 앞판: 맨 아래, 슬리브 위를 덮음. GROOVES 도장 */}
      <div className="absolute inset-x-0 bottom-0 z-10 h-(--crate-h) border-t-[3px] border-(--ink) bg-(--cream) [box-shadow:0_-14px_30px_-18px_rgba(0,0,0,.35)]">
        <p aria-hidden="true" className={`${SERIF} relative mx-auto max-w-[1500px] select-none overflow-hidden whitespace-nowrap px-[clamp(16px,3vw,56px)] text-center text-[clamp(4.2rem,17vw,17rem)] leading-[0.9] text-(--ink) [-webkit-text-stroke:0]`}
          style={{ transform: `translateY(calc((1 - ${seg(0.2, 0.9)}) * 22%))` }}>
          {SITE.name}
        </p>
        <p className="absolute bottom-3 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] uppercase tracking-[0.3em] text-(--ink)/45">Crate No. 1 · Handle with care</p>
      </div>

      {flip && <FlipOverlay from={flip} onCovered={covered} onDone={done} />}
    </footer>
  );
}
