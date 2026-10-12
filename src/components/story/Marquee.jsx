"use client";
// 좌우로 끝없이 흐르는 띠 (움직임 줄이기면 멈춤)
export default function Marquee({ items, className = "", speed = 32, reverse = false }) {
  const row = [...items, ...items];
  return (
    <div className={`overflow-hidden whitespace-nowrap ${className}`} aria-hidden="true">
      <div className="flex w-max animate-marquee motion-reduce:animate-none" style={{ animationDuration: `${speed}s`, animationDirection: reverse ? "reverse" : "normal" }}>
        {row.map((t, i) => <span key={i} className="flex items-center">{t}<span className="mx-[1.2em] opacity-40">✦</span></span>)}
      </div>
    </div>
  );
}
