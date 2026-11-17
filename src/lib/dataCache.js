// 한 번 받아 온 목록 데이터를 다시 쓰기 (신보 · 장르 목록 · 장르별 앨범 수 등 자주 안 바뀌는 것)
//  1) 메모리: 같은 탭에서 페이지를 오가는 동안은 다시 받지 않음
//  2) localStorage: 새로 고치거나 다음에 방문했을 때도 바로 보여 줌
//  규칙 (stale-while-revalidate): 저장된 것이 있으면 그것을 바로 돌려주고, fresh 시간이 지났으면 뒤에서 새로 받아 저장만 해 둠
//   → 화면은 기다리지 않고, 바뀐 내용은 다음에 볼 때 반영됨. keep 시간이 지난 것은 버리고 새로 받음
//  로그인한 사람마다 다른 데이터(내 컬렉션 등)에는 쓰지 말 것 — 공개 목록 전용
const PREFIX = "grooves:data:v1:";
const memory = new Map();   // key → { at, data } | Promise

const read = (key) => {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const hit = JSON.parse(raw);
    return hit && typeof hit.at === "number" ? hit : null;
  } catch { return null; }   // 저장소를 못 쓰는 환경(사생활 보호 창 등)은 그냥 매번 받음
};
const write = (key, hit) => { try { localStorage.setItem(PREFIX + key, JSON.stringify(hit)); } catch { /* 가득 찼거나 막혀 있음 */ } };

const MIN = 60_000;
/**
 * @param {string} key   데이터 이름 (조건이 다르면 key 도 다르게: "shelf:rock")
 * @param {() => Promise<any>} fetcher  실제로 받아 오는 함수 (JSON 으로 저장할 수 있는 값을 돌려줘야 함)
 * @param {{ fresh?: number, keep?: number, valid?: (data: any) => boolean }} [o]
 *   fresh: 이 시간 안에는 다시 받지 않음 (기본 5분) · keep: 이 시간까지는 오래된 것이라도 먼저 보여 줌 (기본 하루)
 *   valid: 저장할 만한 결과인지 (빈 목록 · 실패 결과를 저장하지 않게)
 */
export function cached(key, fetcher, { fresh = 5 * MIN, keep = 24 * 60 * MIN, valid = (d) => d != null } = {}) {
  const now = Date.now();
  const load = () => {
    const p = Promise.resolve().then(fetcher).then((data) => {
      if (valid(data)) { const hit = { at: Date.now(), data }; memory.set(key, hit); write(key, hit); }
      else if (memory.get(key) === p) memory.delete(key);
      return data;
    }, (e) => { if (memory.get(key) === p) memory.delete(key); throw e; });
    return p;
  };
  let hit = memory.get(key);
  if (hit instanceof Promise) return hit;                       // 받는 중이면 같은 요청을 같이 씀
  if (!hit && typeof localStorage !== "undefined") { hit = read(key); if (hit) memory.set(key, hit); }
  if (hit && now - hit.at < keep) {
    if (now - hit.at >= fresh) load().catch(() => {});          // 뒤에서 새로 받아 둠 (지금 화면은 저장된 것으로)
    return Promise.resolve(hit.data);
  }
  const p = load();
  memory.set(key, p);
  return p;
}
