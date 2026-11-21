// 이름 → URL 슬러그. 악센트는 떼고(é → e), 한글은 완성형으로 남긴다.
// NFKD만 쓰면 한글이 자모로 쪼개져 가-힣 범위에서 빠지므로 NFC로 다시 합친다.
export const slugify = (s = "") =>
  s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .normalize("NFC")
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, "-")
    .replace(/^-+|-+$/g, "");
