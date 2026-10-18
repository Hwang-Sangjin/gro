// 스토리 카드·헤더용 커버 그림 (SVG)
// fair: 큰 "15" + 쌓인 판 (이전) / fair-poster: 공식 포스터를 정사각형으로 자름 (© 서울레코드페어) / autumn: 가을색 슬리브와 낙엽 / record: 홈 확대 + 바늘
// a-to-z-NN: Vinyl A to Z 시리즈 — 같은 틀에 회차 번호 + 그 회의 손그림. 바탕·그림 색은 테마를 따라감(--cover-bg / --cover-art)
import { useId } from "react";

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
// 바탕은 늘 크림 계열(밝은 테마 짙은 크림 / 다크 크림)이라 그림·글자색은 고정
const MAPLE_DOODLE = "/images/news/records-for-autumn/maple-doodle.webp";
function AutumnDoodle() {
  const id = `au${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  return (
    <svg viewBox="0 0 400 400" className="size-full" aria-hidden="true">
      <rect width="400" height="400" style={{ fill: "var(--autumn-bg)" }} />
      <mask id={id} style={{ maskType: "alpha" }}>
        <image href={MAPLE_DOODLE} x="52" y="44" width="292" height="284" transform="rotate(-8 198 186)" preserveAspectRatio="xMidYMid meet" />
      </mask>
      <rect width="400" height="400" mask={`url(#${id})`} fill="#cf6a2e" />
      <text x="28" y="44" fontFamily="Hahmlet, Arial, sans-serif" fontSize="13" fontWeight="600" letterSpacing="3.2" fill="#2d6a6a">PICKS</text>
      <text x="374" y="376" textAnchor="end" fontFamily="Grooves Display, Hahmlet, Georgia, serif" fontWeight="900" fontSize="72" letterSpacing="-1" fill="#4c404a">Autumn</text>
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
const AtoZ01 = () => <Series n="01" art="/images/news/what-is-vinyl/lathe-disc.webp" />;
// 02: 판 한 장을 Home 히어로와 같은 각도로 눕혀 가운데에 (2화 히어로와 같은 구도)
const DISC = "/images/news/what-is-vinyl/lathe-disc.webp";
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

const COVERS = { "autumn-doodle": AutumnDoodle, fair: Fair, "fair-poster": FairPoster, autumn: Autumn, record: Record, "a-to-z-01": AtoZ01, "a-to-z-02": AtoZ02 };
export default function StoryCover({ name, className = "" }) {
  const C = COVERS[name] ?? Record;
  return <span className={`block overflow-hidden ${className}`}><C /></span>;
}
