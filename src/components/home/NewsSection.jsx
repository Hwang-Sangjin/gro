"use client";

const POSTS = [
  { no: "01", title: "재발매 소식" },
  { no: "02", title: "바이닐 관리법" },
  { no: "03", title: "이달의 신보" },
];

export default function NewsSection() {
  return (
    <section className="home-panel home-panel-last">
      <div className="home-panel-head">
        <span className="home-label">03 — News</span>
        <span className="home-label">All news →</span>
      </div>

      <div className="home-blocks">
        {POSTS.map((post) => (
          <div className="home-block" key={post.no}>
            <strong>{post.no}</strong>
            <span>{post.title}</span>
          </div>
        ))}
      </div>

      <div className="home-outro">
        <p>먼지를 털고, 바늘을 올릴 시간.</p>
        <a className="home-cta" href="/projects">
          Start digging
        </a>
      </div>

      <footer className="home-footer">
        <h3>Grooves</h3>
        <div className="home-footer-bar">
          <span>© 2026</span>
          <span>Seoul, KR</span>
        </div>
      </footer>
    </section>
  );
}
