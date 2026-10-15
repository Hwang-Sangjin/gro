"use client";
// 레이아웃 자체가 무너졌을 때의 마지막 화면 — 사이트 스타일을 못 쓰므로 직접 그림
export default function GlobalError({ reset }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, minHeight: "100svh", display: "grid", placeItems: "center", background: "#f4e7cd", color: "#4c404a", fontFamily: "Georgia, serif", textAlign: "center", padding: 24 }}>
        <div>
          <p style={{ fontSize: 13, letterSpacing: "0.3em", textTransform: "uppercase", opacity: 0.6, margin: 0 }}>Grooves</p>
          <h1 style={{ fontSize: "clamp(2rem,5vw,3.4rem)", margin: "16px 0 12px" }}>The needle skipped.</h1>
          <p style={{ fontSize: 16, lineHeight: 1.7, opacity: 0.7, margin: 0 }}>Something went wrong. Give it another spin.</p>
          <div style={{ marginTop: 32, display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <button type="button" onClick={() => reset()} style={{ minHeight: 48, padding: "0 28px", borderRadius: 999, border: 0, background: "#4c404a", color: "#f4e7cd", fontSize: 13, letterSpacing: "0.18em", textTransform: "uppercase", cursor: "pointer" }}>Try again</button>
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a href="/" style={{ minHeight: 48, padding: "0 28px", borderRadius: 999, border: "1px solid #4c404a", color: "inherit", fontSize: 13, letterSpacing: "0.18em", textTransform: "uppercase", display: "inline-flex", alignItems: "center", textDecoration: "none" }}>Back home</a>
          </div>
        </div>
      </body>
    </html>
  );
}
