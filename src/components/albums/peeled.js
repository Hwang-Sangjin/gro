// 떼어 낸 NEW IN 스티커 (Crate 에서 스티커를 끌어서 떼면 그 판의 스티커는 그리드 카드에서도 사라짐)
//  이 탭을 닫을 때까지만 기억 — 다음에 오면 다시 붙어 있음 (새로 들어온 판이라는 표시이므로)
const KEY = "grooves:peeled";
let set = null;
const subs = new Set();
function load() {
  if (set) return set;
  set = new Set();
  try { for (const slug of JSON.parse(sessionStorage.getItem(KEY) || "[]")) set.add(slug); } catch {}
  return set;
}
export const isPeeled = (slug) => typeof window !== "undefined" && load().has(slug);
export function markPeeled(slug) {
  if (!slug || load().has(slug)) return;
  set.add(slug);
  try { sessionStorage.setItem(KEY, JSON.stringify([...set])); } catch {}
  for (const f of subs) f();
}
export const subscribePeeled = (f) => { subs.add(f); return () => subs.delete(f); };
