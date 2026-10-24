// src/app/api/admin/places/search/route.ts
// 카카오 장소 검색 — 가게 이름을 넣으면 이름·주소·좌표·카카오맵 링크 후보를 돌려줌 (관리자만)
// GET ?q=김밥레코즈
// 필요: KAKAO_REST_API_KEY (developers.kakao.com → 내 애플리케이션 → 앱 키 → REST API 키, 서버 전용)

import { adminGuard } from "@/lib/admin/auth";

export const runtime = "nodejs";

// "서울 성동구 성수동2가 277-17" → "성수동"
const dongOf = (addr = "") => addr.split(" ").find((w) => /(동|읍|면|리)(\d+가)?$/.test(w))?.replace(/\d+가$/, "") ?? null;

export async function GET(req: Request) {
  const denied = await adminGuard();
  if (denied) return denied;
  const key = process.env.KAKAO_REST_API_KEY;
  if (!key) return Response.json({ error: "KAKAO_REST_API_KEY is not set — click the map to place it instead." }, { status: 501 });
  const q = new URL(req.url).searchParams.get("q")?.trim();
  if (!q) return Response.json({ results: [] });
  try {
    const res = await fetch(`https://dapi.kakao.com/v2/local/search/keyword.json?size=8&query=${encodeURIComponent(q)}`, {
      headers: { Authorization: `KakaoAK ${key}` },
      cache: "no-store",
    });
    if (!res.ok) return Response.json({ error: `Kakao search failed (${res.status}).` }, { status: 502 });
    const json = await res.json();
    const results = (json.documents ?? []).map((d: any) => ({
      name: d.place_name,
      address: d.road_address_name || d.address_name,
      area: dongOf(d.address_name),
      category: d.category_name,
      lat: Number(d.y),
      lng: Number(d.x),
      map_url: d.place_url,
    }));
    return Response.json({ results });
  } catch (e: any) {
    return Response.json({ error: e.message ?? "Unknown error" }, { status: 500 });
  }
}
