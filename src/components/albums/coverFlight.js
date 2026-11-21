// 보기 전환(Grid ↔ List)에서 커버가 제자리로 날아가는 움직임
//  Grid ↔ Crate 는 3D 상자가 따로 하고(crateEngine), 그 밖의 보기 사이는 여기서: 화면 위에 커버 그림의 "허깨비"를 띄워
//  떠난 자리 → 새 자리로 옮긴 뒤 치움. 그동안 진짜 커버는 숨겨 둠 (부르는 쪽이 숨기고 · 다 내려앉으면 다시 보임)
//  같은 판(slug)이 양쪽에 다 보일 때만 날아감 — 화면 밖의 판은 그냥 나타남

const EASE = "cubic-bezier(0.22, 1, 0.36, 1)";
const onScreen = (r) => r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth;

/** 지금 화면의 커버 자리: [data-cover-slug] 요소들 → Map(slug → { rect, image, color, el }) */
export function collectCovers(root) {
  const out = new Map();
  if (!root) return out;
  for (const el of root.querySelectorAll("[data-cover-slug]")) {
    const rect = el.getBoundingClientRect();
    if (onScreen(rect)) out.set(el.dataset.coverSlug, { rect, image: el.dataset.coverImage || null, color: el.dataset.coverColor || "#bbcbda", el });
  }
  return out;
}

/**
 * from: Map(slug → { rect, image, color }) — 떠나는 자리. 부르면 바로 그 자리에 허깨비가 뜸 (새 화면이 그려질 때까지 그대로)
 * 돌려주는 것: to(target, opts) — target: Map(slug → { rect }) 로 날려 보내고, 다 내려앉으면 끝나는 Promise · cancel()
 */
export function startFlight(from) {
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduced || !from.size) return { to: () => Promise.resolve(), cancel() {}, slugs: new Set() };
  const layer = document.createElement("div");
  layer.setAttribute("aria-hidden", "true");
  layer.style.cssText = "position:fixed;inset:0;z-index:60;pointer-events:none;overflow:hidden";
  const ghosts = new Map();
  for (const [slug, s] of from) {
    const g = document.createElement("div"), r = s.rect;
    g.style.cssText = `position:absolute;left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px;transform-origin:0 0;background:${s.color};will-change:transform;box-shadow:0 10px 22px -12px rgb(0 0 0 / .45)`;
    if (s.image) {
      const img = document.createElement("img");
      img.src = s.image; img.alt = ""; img.decoding = "sync";
      img.style.cssText = "display:block;width:100%;height:100%;object-fit:cover";
      g.append(img);
    }
    layer.append(g); ghosts.set(slug, { g, r });
  }
  document.body.append(layer);
  let done = false;
  const cancel = () => { if (!done) { done = true; layer.remove(); } };
  return {
    slugs: new Set(ghosts.keys()),
    cancel,
    to(target, { duration = 720, stagger = 14, fadeRest = 220 } = {}) {
      if (done) return Promise.resolve();
      const jobs = []; let i = 0;
      for (const [slug, { g, r }] of ghosts) {
        const t = target.get(slug);
        if (!t) {   // 새 화면에 없는(안 보이는) 판: 제자리에서 사라짐
          jobs.push(g.animate([{ opacity: 1 }, { opacity: 0 }], { duration: fadeRest, fill: "forwards" }).finished);
          continue;
        }
        const q = t.rect, delay = Math.min(i++, 28) * stagger;
        jobs.push(g.animate(
          [{ transform: "none" }, { transform: `translate(${q.left - r.left}px, ${q.top - r.top}px) scale(${q.width / r.width}, ${q.height / r.height})` }],
          { duration, delay, easing: EASE, fill: "forwards" }).finished);
      }
      return Promise.all(jobs).catch(() => {}).then(cancel);
    },
  };
}
