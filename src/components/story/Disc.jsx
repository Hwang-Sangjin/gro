// 검은 판 (가는 홈 + 라벨) — 스토리에서 슬리브 뒤로 빠져나오는 판
export default function Disc({ label = "#f4e7cd", className = "", style }) {
  return (
    <svg viewBox="0 0 200 200" className={className} style={style} aria-hidden="true">
      <circle cx="100" cy="100" r="99" fill="#1b1619" />
      {Array.from({ length: 16 }, (_, i) => (
        <circle key={i} cx="100" cy="100" r={94 - i * 3.6} fill="none" stroke="#f4e7cd" strokeWidth=".6" opacity={i % 5 === 2 ? 0.05 : 0.14} />
      ))}
      <path d="M100 6a94 94 0 0 1 80 46" fill="none" stroke="#fff" strokeWidth="10" opacity=".05" />
      <circle cx="100" cy="100" r="31" fill={label} />
      <circle cx="100" cy="100" r="3" fill="#1b1619" />
    </svg>
  );
}
