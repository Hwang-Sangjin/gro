// 트랙 입력 "A | 제목 | 4:32" (한 줄에 한 곡, 시간은 생략 가능) — 요청 창·관리자 등록 폼 공용
export const TRACK_PLACEHOLDER = "A | Nikes | 5:14\nA | Ivy | 4:09\nB | Pink + White | 3:04";
export const FORMATS = ["LP", "2LP", "3LP", "EP", "7inch", "box"];

export function parseTracks(text) {
  const rows = [];
  const errors = [];
  (text ?? "").split("\n").map((l) => l.trim()).filter(Boolean).forEach((line, i) => {
    const [sideRaw, titleRaw, durRaw] = line.split("|").map((s) => s?.trim());
    const side = (sideRaw ?? "").toUpperCase();
    if (!/^[A-H]$/.test(side)) return errors.push(`Line ${i + 1}: side must be A–H`);
    if (!titleRaw) return errors.push(`Line ${i + 1}: missing track title`);
    let duration = null;
    if (durRaw) {
      const m = durRaw.match(/^(\d+):(\d{1,2})$/);
      if (!m) return errors.push(`Line ${i + 1}: time looks like 4:32`);
      duration = Number(m[1]) * 60 + Number(m[2]);
    }
    rows.push({ side, title: titleRaw, duration });
  });
  return { rows, errors };
}
