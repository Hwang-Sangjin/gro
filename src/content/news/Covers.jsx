// 스토리 카드·헤더용 커버 그림 (SVG, 테마 색을 따라감)
// fair: 큰 "15" + 쌓인 판 / autumn: 가을색 슬리브와 낙엽 / record: 홈 확대 + 바늘

function Fair() {
  return (
    <svg viewBox="0 0 400 400" className="size-full" aria-hidden="true">
      <rect width="400" height="400" fill="#c8553d" />
      <g fill="none" stroke="#f4e7cd" strokeOpacity=".22">{[160, 140, 120, 100, 80].map((r) => <circle key={r} cx="200" cy="230" r={r} />)}</g>
      <text x="200" y="250" textAnchor="middle" fontFamily="Grooves Bodoni, Georgia, serif" fontWeight="900" fontSize="230" letterSpacing="-12" fill="#f4e7cd">15</text>
      <g transform="translate(46 318)">{[0, 1, 2, 3, 4].map((i) => <rect key={i} x={i * 4} y={-i * 9} width="300" height="7" rx="2" fill={i % 2 ? "#4c404a" : "#2a222a"} />)}</g>
      <text x="40" y="60" fontFamily="PP Neue Montreal, Arial, sans-serif" fontSize="13" letterSpacing="2.4" fill="#f4e7cd">SEOUL RECORD FAIR</text>
      <text x="360" y="60" textAnchor="end" fontFamily="PP Neue Montreal, Arial, sans-serif" fontSize="13" letterSpacing="1.5" fill="#f4e7cd" opacity=".75">10.31 — 11.01</text>
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
      <path d="M92 318c18-26 46-34 70-26-10 24-38 38-70 26z" fill="#c8553d" /><path d="M92 318c24-6 48-12 70-26" stroke="#8a3b1f" fill="none" />
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
        <rect x="-6" y="-170" width="12" height="150" fill="#f4e7cd" /><path d="M-14 -20h28l-10 26h-8z" fill="#f4e7cd" /><path d="M-1 6l1 14 1-14z" fill="#c8553d" />
      </g>
    </svg>
  );
}

const COVERS = { fair: Fair, autumn: Autumn, record: Record };
export default function StoryCover({ name, className = "" }) {
  const C = COVERS[name] ?? Record;
  return <span className={`block overflow-hidden ${className}`}><C /></span>;
}
