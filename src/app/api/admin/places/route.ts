// src/app/api/admin/places/route.ts
// 장소 등록·수정 — 관리자만
// POST JSON { id?, slug, name, kind, also, lat, lng, … }  id 가 있으면 수정, 없으면 새로 등록
// kind = 1번 종류(대표, 지도 마커 색), also = 2번부터 (고른 순서대로)

import { adminGuard, serviceClient } from "@/lib/admin/auth";
import { slugify, cleanInstagram } from "@/lib/places";

export const runtime = "nodejs";
const KINDS = ["shop", "bar", "listening", "event"];
const STATUSES = ["published", "draft"];
const text = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
const date = (v: unknown) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);

export async function POST(req: Request) {
  const denied = await adminGuard();
  if (denied) return denied;
  try {
    const p = await req.json();
    const name = text(p.name);
    const slug = slugify(text(p.slug) ?? name ?? "");
    const lat = Number(p.lat), lng = Number(p.lng);
    if (!name) return Response.json({ error: "Name is required." }, { status: 400 });
    if (!slug) return Response.json({ error: "Slug is required." }, { status: 400 });
    if (!KINDS.includes(p.kind)) return Response.json({ error: "Pick a kind." }, { status: 400 });
    const also = Array.isArray(p.also) ? [...new Set(p.also.filter((k: unknown) => typeof k === "string" && KINDS.includes(k) && k !== p.kind))] : [];
    const isEvent = p.kind === "event" || also.includes("event");
    // 위치는 숨김(draft)일 때만 비워둘 수 있음 — 지도에 보이려면 핀이 꼭 있어야 함
    const hasPin = p.lat != null && p.lng != null && p.lat !== "" && p.lng !== "";
    if (hasPin && (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < 33 || lat > 39.5 || lng < 124 || lng > 132)) {
      return Response.json({ error: "That pin is outside Korea — click the map again." }, { status: 400 });
    }
    if (!hasPin && p.status === "published") {
      return Response.json({ error: "Put a pin on the map before showing it on the map." }, { status: 400 });
    }
    const row = {
      slug, name, kind: p.kind, also, lat: hasPin ? lat : null, lng: hasPin ? lng : null,
      name_en: text(p.name_en), area: text(p.area), address: text(p.address), hours: text(p.hours),
      instagram: text(cleanInstagram(p.instagram ?? "")), website: text(p.website), map_url: text(p.map_url),
      note: text(p.note), news_slug: text(p.news_slug),
      genres: Array.isArray(p.genres) ? p.genres.filter((g: unknown) => typeof g === "string") : [],
      starts_on: isEvent ? date(p.starts_on) : null,
      ends_on: isEvent ? date(p.ends_on) : null,
      status: STATUSES.includes(p.status) ? p.status : "draft",
    };
    const db = serviceClient();
    const q = p.id ? db.from("places").update(row).eq("id", p.id) : db.from("places").insert(row);
    const { data, error } = await q.select("id, slug, status").maybeSingle();
    if (error) {
      if (error.code === "23505") return Response.json({ error: `Slug '${slug}' is already used by another place.` }, { status: 409 });
      throw new Error(error.message);
    }
    if (!data) return Response.json({ error: "Place not found." }, { status: 404 });
    return Response.json({ ok: true, ...data });
  } catch (e: any) {
    return Response.json({ error: e.message ?? "Unknown error" }, { status: 500 });
  }
}
