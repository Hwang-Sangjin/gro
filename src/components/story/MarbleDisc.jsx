// 마블 컬러 바이닐 — SVG 노이즈를 세 가지 색 띠로 나눠 칠하고 홈·라벨을 얹음
// colors: [가장 많은 색, 중간, 가장 적은 색] (hex), seed 로 무늬가 달라짐
import { useId } from "react";

const rgb = (hex) => { const n = parseInt(hex.slice(1), 16); return [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]; };

export default function MarbleDisc({ colors, seed = 1, label = "#f4e7cd", className = "", style }) {
  const id = `m${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const [a, b, c] = colors.map(rgb);
  // 노이즈 값(0~1)을 12칸으로 나눠 색을 배정 — 비중: a 6칸, b 4칸, c 2칸. 두 겹 노이즈로 휘감아 마블 결을 냄
  const band = (k) => [a, a, b, a, c, b, a, a, c, b, a, b].map((v) => v[k].toFixed(3)).join(" ");
  return (
    <svg viewBox="0 0 200 200" className={className} style={style} aria-hidden="true">
      <defs>
        <filter id={`${id}f`} x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency="0.006" numOctaves="5" seed={seed} result="n" />
          <feTurbulence type="turbulence" baseFrequency="0.02" numOctaves="2" seed={seed + 5} result="w" />
          <feDisplacementMap in="n" in2="w" scale="120" xChannelSelector="R" yChannelSelector="G" result="d" />
          <feColorMatrix in="d" type="matrix" values="1 0 0 0 0  1 0 0 0 0  1 0 0 0 0  0 0 0 0 1" />
          <feComponentTransfer>
            <feFuncR type="discrete" tableValues={band(0)} />
            <feFuncG type="discrete" tableValues={band(1)} />
            <feFuncB type="discrete" tableValues={band(2)} />
          </feComponentTransfer>
          <feGaussianBlur stdDeviation="1.1" />
        </filter>
        <clipPath id={`${id}c`}><circle cx="100" cy="100" r="99" /></clipPath>
      </defs>
      <g clipPath={`url(#${id}c)`}>
        <rect width="200" height="200" filter={`url(#${id}f)`} />
        {Array.from({ length: 14 }, (_, i) => <circle key={i} cx="100" cy="100" r={95 - i * 4.4} fill="none" stroke="#000" strokeOpacity={i % 4 === 1 ? 0.05 : 0.11} strokeWidth=".6" />)}
        <path d="M100 4a96 96 0 0 1 82 48" fill="none" stroke="#fff" strokeWidth="14" opacity=".12" />
      </g>
      <circle cx="100" cy="100" r="99" fill="none" stroke="#000" strokeOpacity=".18" />
      <circle cx="100" cy="100" r="30" fill={label} />
      <circle cx="100" cy="100" r="3" fill="#1b1619" />
    </svg>
  );
}
