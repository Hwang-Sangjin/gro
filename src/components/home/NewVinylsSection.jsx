"use client";

// 진열대 자리표시자. 나중에 R3F Canvas 로 교체된다
const SLEEVE_COUNT = 5;

export default function NewVinylsSection() {
  return (
    <section className="home-panel">
      <div className="home-panel-head">
        <span className="home-label">02 — New vinyls</span>
        <span className="home-label">Browse →</span>
      </div>

      <h2>이번 주에 들어온 판.</h2>

      <div className="home-shelf">
        {Array.from({ length: SLEEVE_COUNT }, (_, i) => (
          <div className="home-sleeve" key={i} />
        ))}
      </div>

      <p className="home-meta">
        Sunday Morning / The Lanes — LP · 2025 · Jazz-Ambient
      </p>
    </section>
  );
}
