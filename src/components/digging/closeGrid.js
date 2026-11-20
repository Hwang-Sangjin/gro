"use client";
// Digging·Collection 공용: 판 목록을 바꾸기 전에 지금 판들을 접어서 닫음

/* 지금 그리드의 판들을 등장 때와 반대로 접어서 닫음 (그림이 먼저 흐려지고, 가운데 세로선으로 접힘) */
export default function closeGrid(wrap) {
  if (!wrap || matchMedia("(prefers-reduced-motion: reduce)").matches) return Promise.resolve();
  const H = innerHeight;
  const ease = "cubic-bezier(0.55, 0, 0.75, 0.2)";
  const jobs = [];
  wrap.querySelectorAll("a[data-album-slug]").forEach((card) => {
    const r = card.getBoundingClientRect();
    const visible = r.bottom > 0 && r.top < H;
    const panel = card.querySelector("[data-image-ready]");
    const caption = card.lastElementChild;
    if (!visible || !panel) { card.style.visibility = "hidden"; return; }
    const delay = Math.random() * 120;
    const media = panel.querySelector("img, span");
    if (media) jobs.push(media.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 180, delay, easing: "ease-in", fill: "forwards" }).finished);
    jobs.push(panel.animate(
      [{ clipPath: "inset(0 0 0 0)" }, { clipPath: "inset(0 calc(50% - 2px) 0 calc(50% - 2px))", offset: 0.85 }, { clipPath: "inset(50% calc(50% - 2px) 50% calc(50% - 2px))" }],
      { duration: 520, delay: delay + 140, easing: ease, fill: "forwards" }).finished);
    if (caption) jobs.push(caption.animate([{ opacity: getComputedStyle(caption).opacity }, { opacity: 0 }], { duration: 260, delay, fill: "forwards" }).finished);
  });
  // 판이 없는 화면(빈 상태 안내 등)은 살짝 내려가며 흐려짐
  if (!wrap.querySelector("a[data-album-slug]")) {
    for (const el of wrap.children) jobs.push(el.animate([{ opacity: 1, transform: "none" }, { opacity: 0, transform: "translateY(12px)" }], { duration: 320, easing: "ease-in", fill: "forwards" }).finished);
  }
  return Promise.all(jobs).catch(() => {});
}
