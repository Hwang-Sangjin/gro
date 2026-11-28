// 사용자가 적은 주소를 링크로 쓰기 전에 거르는 곳
// http:// · https:// 로 시작하는 웹 주소만 통과. javascript: · data: 같은 주소는 null
// (링크로 그리면 클릭할 때 스크립트가 실행될 수 있음)
export function safeHttpUrl(value) {
  if (typeof value !== "string") return null;
  const v = value.trim();
  if (!v) return null;
  try {
    const url = new URL(v);
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}

// <input pattern> 용: 브라우저에서 미리 막음 (최종 확인은 safeHttpUrl · DB 규칙)
export const HTTP_URL_PATTERN = "https?://.+";
