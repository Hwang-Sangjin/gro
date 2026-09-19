import { forwardRef } from "react";

// 기울어진 바이닐 + 궤도 링 + 4각 별
const VinylMark = forwardRef(function VinylMark({ className }, ref) {
  return (
    <svg
      ref={ref}
      className={className}
      viewBox="0 0 240 120"
      fill="none"
      aria-hidden="true"
    >
      {/* 별 */}
      <path
        transform="translate(26 58)"
        fill="var(--accent-rust)"
        d="M0-15C1.5-4 4-1.5 15 0 4 1.5 1.5 4 0 15-1.5 4-4 1.5-15 0-4-1.5-1.5-4 0-15Z"
      />

      <g transform="translate(144 60) rotate(-16)">
        {/* 궤도 링 — 뒤쪽 반 */}
        <ellipse
          rx="88"
          ry="30"
          stroke="var(--accent-rust)"
          strokeWidth="1.6"
        />

        {/* 디스크 */}
        <ellipse rx="62" ry="27" fill="var(--accent-blue)" />
        {[54, 46, 38, 30].map((rx) => (
          <ellipse
            key={rx}
            rx={rx}
            ry={rx * 0.435}
            stroke="var(--page-bg, #f4e7cd)"
            strokeOpacity="0.45"
            strokeWidth="0.9"
          />
        ))}
        <ellipse rx="20" ry="8.7" fill="var(--accent-rust)" />
        <ellipse rx="3" ry="1.4" fill="var(--page-bg, #f4e7cd)" />

        {/* 궤도 링 — 앞쪽 반(디스크 위로 지나감) */}
        <path
          d="M-88 0A88 30 0 0 0 88 0"
          stroke="var(--accent-rust)"
          strokeWidth="1.6"
        />
      </g>
    </svg>
  );
});

export default VinylMark;
