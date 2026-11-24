// 스토리 카드·헤더용 커버 그림 (SVG)
// fair: 큰 "15" + 쌓인 판 (이전) / fair-poster: 공식 포스터를 정사각형으로 자름 (© 서울레코드페어) / autumn: 가을색 슬리브와 낙엽 / record: 홈 확대 + 바늘
// a-to-z-NN: Vinyl A to Z 시리즈 — 같은 틀에 회차 번호 + 그 회의 손그림. 바탕·그림 색은 테마를 따라감(--cover-bg / --cover-art)
import { useId } from "react";
import Disc from "@/components/story/Disc";
import { RELEASES, findRow, coverOf, useCaesar } from "./daniel-caesar-korean-vinyl/albums";
import { ALBUM_SLUG as SAKAMOTO_SLUG, coverOf as coverOfSakamoto, useSakamoto } from "./ryuichi-sakamoto-1996/album";

function Fair() {
  return (
    <svg viewBox="0 0 400 400" className="size-full" aria-hidden="true">
      <rect width="400" height="400" fill="#2d6a6a" />
      <g fill="none" stroke="#f4e7cd" strokeOpacity=".22">{[160, 140, 120, 100, 80].map((r) => <circle key={r} cx="200" cy="230" r={r} />)}</g>
      <text x="200" y="250" textAnchor="middle" fontFamily="Grooves Display, Hahmlet, Georgia, serif" fontWeight="900" fontSize="230" letterSpacing="-1" fill="#f4e7cd">15</text>
      <g transform="translate(46 318)">{[0, 1, 2, 3, 4].map((i) => <rect key={i} x={i * 4} y={-i * 9} width="300" height="7" rx="2" fill={i % 2 ? "#4c404a" : "#2a222a"} />)}</g>
      <text x="40" y="60" fontFamily="Hahmlet, Arial, sans-serif" fontSize="13" letterSpacing="2.4" fill="#f4e7cd">SEOUL RECORD FAIR</text>
      <text x="360" y="60" textAnchor="end" fontFamily="Hahmlet, Arial, sans-serif" fontSize="13" letterSpacing="1.5" fill="#f4e7cd" opacity=".75">10.31 — 11.01</text>
    </svg>
  );
}
function FairPoster() {
  return (
    <svg viewBox="0 0 400 400" className="size-full" aria-hidden="true">
      <rect width="400" height="400" fill="#fff" />
      <image href="/images/news/seoul-record-fair-2026/poster-square.webp" width="400" height="400" preserveAspectRatio="xMidYMid slice" />
    </svg>
  );
}
// SSE PBR FEST: 공식 포스터의 글자 쌓기 부분을 정사각형으로 (© 쎄 프로젝트)
function SsePoster() {
  return (
    <svg viewBox="0 0 400 400" className="size-full" aria-hidden="true">
      <rect width="400" height="400" fill="#fff" />
      <image href="/images/news/sse-pbr-fest/poster-square.webp" width="400" height="400" preserveAspectRatio="xMidYMid slice" />
    </svg>
  );
}
function Autumn() {
  const sleeves = ["#8a3b1f", "#c9822b", "#e3b04b", "#5b4a2e"];
  return (
    <svg viewBox="0 0 400 400" className="size-full" aria-hidden="true">
      <rect width="400" height="400" fill="#efe0c2" />
      {sleeves.map((c, i) => <rect key={c} x={70 + i * 26} y={70 + i * 22} width="200" height="200" fill={c} transform={`rotate(${-8 + i * 5} ${170 + i * 26} ${170 + i * 22})`} />)}
      <g transform="translate(250 255)">
        <circle r="96" fill="#2a222a" /><g fill="none" stroke="#f4e7cd" strokeOpacity=".14">{[86, 74, 62, 50].map((r) => <circle key={r} r={r} />)}</g>
        <circle r="30" fill="#e3b04b" /><circle r="3" fill="#2a222a" />
      </g>
      <path d="M92 318c18-26 46-34 70-26-10 24-38 38-70 26z" fill="#2d6a6a" /><path d="M92 318c24-6 48-12 70-26" stroke="#8a3b1f" fill="none" />
    </svg>
  );
}
// Picks 가을: Vinyl A to Z 썸네일과 같은 틀 — 손그림 단풍잎(투명 배경 선화)의 알파를 마스크로 써서 단풍색으로 칠함.
// 밝은 테마: 브라운 바탕 + 크림 글자 / 다크: 크림 바탕 + 잉크 글자 (--autumn-* 토큰)
const MAPLE_DOODLE = "/images/news/records-for-autumn/maple-doodle.webp";
function AutumnDoodle() {
  const id = `au${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  return (
    <svg viewBox="0 0 400 400" className="size-full" aria-hidden="true">
      <rect width="400" height="400" style={{ fill: "var(--autumn-bg)" }} />
      <mask id={id} style={{ maskType: "alpha" }}>
        <image href={MAPLE_DOODLE} x="52" y="44" width="292" height="284" transform="rotate(-8 198 186)" preserveAspectRatio="xMidYMid meet" />
      </mask>
      <rect width="400" height="400" mask={`url(#${id})`} style={{ fill: "var(--autumn-leaf)" }} />
      <text x="28" y="44" fontFamily="Hahmlet, Arial, sans-serif" fontSize="13" fontWeight="600" letterSpacing="3.2" style={{ fill: "var(--autumn-tag)" }}>PICKS</text>
      <text x="374" y="376" textAnchor="end" fontFamily="Grooves Display, Hahmlet, Georgia, serif" fontWeight="900" fontSize="72" letterSpacing="-1" style={{ fill: "var(--autumn-ink)" }}>Autumn</text>
    </svg>
  );
}
// 다니엘 시저 국내 발매: 마블 판 세 장이 겹쳐 있고 아래에 이름
// 다니엘 시저 국내반 세 장의 실제 커버 (Grooves DB). 못 찾으면 검은 판
function Caesar() {
  const rows = useCaesar();
  return (
    <div className="absolute inset-0 bg-(--cover-bg)">
      {/* 커버는 왼쪽 정사각형 무대 안에 — 가로로 긴 카드에서도 비율 유지 */}
      <div className="absolute inset-y-0 left-0 aspect-square max-w-full">
      {RELEASES.map((r, i) => {
        const row = findRow(rows, r);
        const src = coverOf(row);
        const pos = { left: `${6 + i * 16}%`, top: `${34 - i * 9}%`, zIndex: 3 - i, rotate: `${(i - 1) * 4}deg` };
        if (src) return <img key={r.slug} src={src} alt="" loading="lazy" decoding="async" draggable={false} className="absolute aspect-square h-auto w-[46%] select-none rounded-[2px] object-cover shadow-[0_10px_18px_-8px_rgba(0,0,0,.5)]" style={{ ...pos, background: row.cover_color || "#888" }} />;
        if (rows === null) return <span key={r.slug} className="absolute aspect-square w-[46%] rounded-[2px] bg-(--ink)/8" style={pos} />;
        return <Disc key={r.slug} label={r.label} className="absolute w-[46%] drop-shadow-[0_10px_14px_rgba(0,0,0,.28)]" style={pos} />;
      })}
      </div>
      <p className="absolute left-[7%] top-[7%] z-10 font-['Hahmlet',sans-serif] font-semibold tracking-[0.24em] text-(--accent)" style={{ fontSize: "3.2cqw" }}>NEWS · RELEASE</p>
      <p className="absolute bottom-[6%] right-[6%] z-10 text-right font-['Grooves_Display','Hahmlet',serif] leading-[0.9] text-(--ink)" style={{ fontSize: "10.5cqw" }}>Daniel<br />Caesar</p>
    </div>
  );
}
// 류이치 사카모토 1996 — 사용자가 준 손그림 초상 (2026-11-24 확정 썸네일, 900px webp)
function SakamotoPortrait() {
  return (
    <svg viewBox="0 0 400 400" className="size-full" aria-hidden="true">
      <rect width="400" height="400" fill="#000" />
      <image href="/images/news/ryuichi-sakamoto-1996/thumb.webp" width="400" height="400" preserveAspectRatio="xMidYMid slice" />
    </svg>
  );
}
// 류이치 사카모토 1996 — 썸네일 후보 세 가지 (index.js 의 cover 에서 고름)
// A sakamoto-1996: 실제 커버(Grooves DB) + 오른쪽으로 빠져나온 판. 못 찾으면 판만
function Sakamoto() {
  const row = useSakamoto()?.find((a) => a.slug === SAKAMOTO_SLUG);
  const src = coverOfSakamoto(row);
  return (
    <div className="absolute inset-0 bg-(--cover-bg)">
      <div className="absolute inset-y-0 left-0 aspect-square max-w-full">
        <Disc label="#e9e4da" className="absolute left-[30%] top-[22%] w-[52%] drop-shadow-[0_10px_14px_rgba(0,0,0,.28)]" />
        {src && <img src={src} alt="" loading="lazy" decoding="async" draggable={false} className="absolute left-[8%] top-[20%] aspect-square h-auto w-[54%] select-none rounded-[2px] object-cover shadow-[0_12px_22px_-8px_rgba(0,0,0,.55)]" style={{ background: row.cover_color || "#181818" }} />}
      </div>
      <p className="absolute left-[7%] top-[7%] z-10 font-['Hahmlet',sans-serif] font-semibold tracking-[0.24em] text-(--accent)" style={{ fontSize: "3.2cqw" }}>NEWS · REISSUE</p>
      <p className="absolute bottom-[6%] right-[6%] z-10 text-right font-['Grooves_Display','Hahmlet',serif] leading-[0.9] text-(--ink)" style={{ fontSize: "10.5cqw" }}>Sakamoto<br />1996</p>
    </div>
  );
}
// B sakamoto-type: 잉크 바탕에 큰 1996 + 세 악기를 뜻하는 세 줄(굵기가 다른 현)
function SakamotoType() {
  return (
    <svg viewBox="0 0 400 400" className="size-full" aria-hidden="true">
      <rect width="400" height="400" fill="#181818" />
      {[[150, 4], [178, 2.4], [202, 1.2]].map(([y, w], i) => (
        <path key={i} d={`M0 ${y} C110 ${y - 26} 250 ${y + 26} 400 ${y}`} fill="none" stroke="#f4e7cd" strokeWidth={w} opacity={0.85 - i * 0.2} />
      ))}
      <text x="28" y="44" fontFamily="Hahmlet, Arial, sans-serif" fontSize="13" fontWeight="600" letterSpacing="3.2" fill="#7fc1bd">PIANO · CELLO · VIOLIN</text>
      <text x="374" y="350" textAnchor="end" fontFamily="Grooves Display, Hahmlet, Georgia, serif" fontWeight="900" fontSize="120" letterSpacing="-2" fill="#f4e7cd">1996</text>
      <text x="374" y="378" textAnchor="end" fontFamily="Hahmlet, Arial, sans-serif" fontSize="14" letterSpacing="2.4" fill="#f4e7cd" opacity=".7">RYUICHI SAKAMOTO</text>
    </svg>
  );
}
// C sakamoto-frame: 시네마스코프 프레임(별밤) + 영화 자막
function SakamotoFrame() {
  return (
    <svg viewBox="0 0 400 400" className="size-full" aria-hidden="true">
      <rect width="400" height="400" fill="#0d0b0c" />
      <rect y="116" width="400" height="168" fill="#1b1619" />
      <g fill="#f4e7cd">{Array.from({ length: 60 }, (_, i) => <circle key={i} cx={(i * 67) % 400} cy={124 + ((i * 41) % 110)} r={i % 7 === 0 ? 1.4 : 0.7} opacity={0.3 + (i % 4) * 0.15} />)}</g>
      <path d="M0 262 Q100 246 200 258 T400 252 V284 H0z" fill="#120f11" />
      <text x="200" y="272" textAnchor="middle" fontFamily="Hahmlet, serif" fontSize="17" fontWeight="600" fill="#f6e9a8">“Merry Christmas, Mr. Lawrence.”</text>
      <text x="28" y="60" fontFamily="Hahmlet, Arial, sans-serif" fontSize="13" fontWeight="600" letterSpacing="3.2" fill="#7fc1bd">SCORES &amp; SCENES</text>
      <text x="372" y="360" textAnchor="end" fontFamily="Grooves Display, Hahmlet, Georgia, serif" fontWeight="900" fontSize="52" fill="#f4e7cd">Sakamoto, 1996</text>
    </svg>
  );
}
function Record() {
  return (
    <svg viewBox="0 0 400 400" className="size-full" aria-hidden="true">
      <rect width="400" height="400" fill="#2a222a" />
      <g fill="none" stroke="#bbcbda">{Array.from({ length: 14 }, (_, i) => (
        <path key={i} strokeOpacity={0.25 + (i % 3) * 0.2} strokeWidth={i % 4 === 0 ? 2.2 : 1.2}
          d={`M-20 ${70 + i * 22} ${Array.from({ length: 22 }, (_, k) => `L${k * 20} ${70 + i * 22 + Math.sin(k * 0.9 + i) * (i > 5 && i < 9 ? 7 : 2)}`).join(" ")}`} />
      ))}</g>
      <g transform="translate(250 160) rotate(28)">
        <rect x="-6" y="-170" width="12" height="150" fill="#f4e7cd" /><path d="M-14 -20h28l-10 26h-8z" fill="#f4e7cd" /><path d="M-1 6l1 14 1-14z" fill="#2d6a6a" />
      </g>
    </svg>
  );
}

/* Vinyl A to Z 시리즈 썸네일. art: 투명 배경 손그림(webp) — 알파를 마스크로 써서 테마 색으로 칠함 */
function Series({ n, art, box = [70, 60, 260, 260], arts }) {
  const id = `az${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const list = arts ?? [{ href: art, box }];   // 여러 장: [{ href, box: [x, y, w, h] }]
  return (
    <svg viewBox="0 0 400 400" className="size-full" aria-hidden="true">
      <rect width="400" height="400" style={{ fill: "var(--cover-bg)" }} />
      <mask id={id} style={{ maskType: "alpha" }}>
        {list.map(({ href, box: [x, y, w, h] }, i) => <image key={i} href={href} x={x} y={y} width={w} height={h} preserveAspectRatio="xMidYMid meet" />)}
      </mask>
      <rect width="400" height="400" mask={`url(#${id})`} style={{ fill: "var(--cover-art)" }} />
      <text x="28" y="44" fontFamily="Hahmlet, Arial, sans-serif" fontSize="13" fontWeight="600" letterSpacing="3.2" style={{ fill: "var(--accent)" }}>VINYL A TO Z</text>
      <text x="374" y="376" textAnchor="end" fontFamily="Grooves Display, Hahmlet, Georgia, serif" fontWeight="900" fontSize="88" letterSpacing="-1" style={{ fill: "var(--ink)" }}>{n}</text>
    </svg>
  );
}
// 회차가 늘면 여기에 한 줄씩 (번호, 그림)
//  판 그림은 표지 전용 사본(lathe-disc-mask.webp · 78KB)을 씀 (2026-11-22 최적화): 표지에서는 알파만 마스크로 쓰는데 원본(322KB)은 색까지 담고 있음.
//  SVG <image> 는 늦게 받기(lazy)가 안 돼서 Home · News · 메뉴를 열 때마다 바로 받음. 같은 크기(900px) · 색만 비움 · 알파 품질 60 — 원본을 고치면 다시 만들 것
const DISC = "/images/news/what-is-vinyl/lathe-disc-mask.webp";
const AtoZ01 = () => <Series n="01" art={DISC} />;
// 02: 판 한 장을 Home 히어로와 같은 각도로 눕혀 가운데에 (2화 히어로와 같은 구도)
function AtoZ02() {
  const id = `az2${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const stack = [[200, 200, 300]];   // [가운데 x, y, 지름]
  return (
    <svg viewBox="0 0 400 400" className="size-full" aria-hidden="true">
      <rect width="400" height="400" style={{ fill: "var(--cover-bg)" }} />
      {stack.map(([cx, cy, d], i) => (
        <g key={i} transform={`translate(${cx} ${cy}) rotate(-33) scale(1 .643)`}>
          <mask id={`${id}-${i}`} style={{ maskType: "alpha" }}><image href={DISC} x={-d / 2} y={-d / 2} width={d} height={d} /></mask>
          <circle r={d / 2 - 1} style={{ fill: "var(--cover-bg)" }} />
          <rect x={-d / 2} y={-d / 2} width={d} height={d} mask={`url(#${id}-${i})`} style={{ fill: "var(--cover-art)" }} />
        </g>
      ))}
      <text x="28" y="44" fontFamily="Hahmlet, Arial, sans-serif" fontSize="13" fontWeight="600" letterSpacing="3.2" style={{ fill: "var(--accent)" }}>VINYL A TO Z</text>
      <text x="374" y="376" textAnchor="end" fontFamily="Grooves Display, Hahmlet, Georgia, serif" fontWeight="900" fontSize="88" letterSpacing="-1" style={{ fill: "var(--ink)" }}>02</text>
    </svg>
  );
}

// 04: 위에서 내려다본 턴테이블 선화 (본체 · 플래터 · 판 홈 · 톤암 · 카운터웨이트) — 다른 회차처럼 테마 색(--cover-art)으로
function AtoZ04() {
  const line = { fill: "none", stroke: "var(--cover-art)", strokeWidth: 3, strokeLinecap: "round", strokeLinejoin: "round" };
  return (
    <svg viewBox="0 0 400 400" className="size-full" aria-hidden="true">
      <rect width="400" height="400" style={{ fill: "var(--cover-bg)" }} />
      <g transform="translate(200 205) rotate(-8)">
        <rect x="-150" y="-112" width="300" height="224" rx="14" style={line} />
        <circle cx="-30" cy="-4" r="98" style={line} />
        {[86, 72, 58, 44].map((r) => <circle key={r} cx="-30" cy="-4" r={r} style={{ ...line, strokeWidth: 1.2, opacity: 0.55 }} />)}
        <circle cx="-30" cy="-4" r="30" style={{ fill: "var(--cover-art)", opacity: 0.85 }} />
        <circle cx="-30" cy="-4" r="3" style={{ fill: "var(--cover-bg)" }} />
        <circle cx="104" cy="-66" r="14" style={line} />
        <path d="M104 -66 L112 -96 M104 -66 L86 20 L58 44" style={{ ...line, strokeWidth: 3.5 }} />
        <rect x="100" y="-112" width="16" height="20" rx="4" style={line} />
        <path d="M50 38 l14 14" style={{ ...line, strokeWidth: 5 }} />
        <circle cx="-122" cy="84" r="9" style={line} /><circle cx="-98" cy="92" r="5" style={line} /><circle cx="-80" cy="92" r="5" style={line} />
      </g>
      <text x="28" y="44" fontFamily="Hahmlet, Arial, sans-serif" fontSize="13" fontWeight="600" letterSpacing="3.2" style={{ fill: "var(--accent)" }}>VINYL A TO Z</text>
      <text x="374" y="376" textAnchor="end" fontFamily="Grooves Display, Hahmlet, Georgia, serif" fontWeight="900" fontSize="88" letterSpacing="-1" style={{ fill: "var(--ink)" }}>04</text>
    </svg>
  );
}

const COVERS = { "sakamoto-portrait": SakamotoPortrait, "sakamoto-1996": Sakamoto, "sakamoto-type": SakamotoType, "sakamoto-frame": SakamotoFrame, caesar: Caesar, "autumn-doodle": AutumnDoodle, fair: Fair, "fair-poster": FairPoster, "sse-poster": SsePoster, autumn: Autumn, record: Record, "a-to-z-01": AtoZ01, "a-to-z-02": AtoZ02, "a-to-z-04": AtoZ04 };
export default function StoryCover({ name, className = "" }) {
  const C = COVERS[name] ?? Record;
  // 위치(position)는 부르는 쪽이 정하면 그대로 — 기본 relative 를 같이 두면 CSS 순서상 relative 가 이겨서
  //  absolute 로 겹쳐 둔 커버들이 세로로 쌓였음 (Home News 의 마우스 따라오는 커버가 줄 번호만큼 아래로 밀려 보이던 문제)
  const pos = /(^|\s)(absolute|fixed|sticky|static)(\s|$)/.test(className) ? "" : "relative";
  return <span className={`${pos} block overflow-hidden [container-type:inline-size] ${className}`}><C /></span>;
}
