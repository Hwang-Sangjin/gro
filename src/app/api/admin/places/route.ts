// src/app/api/admin/places/route.ts
// 장소 등록·수정 — 관리자만
// POST JSON { id?, slug, name, kind, lat, lng, … }  id 가 있으면 수정, 없으면 새로 등록

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
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < 33 || lat > 39.5 || lng < 124 || lng > 132) {
      return Response.json({ error: "Set the location — click the map." }, { status: 400 });
    }
    const row = {
      slug, name, lat, lng, kind: p.kind,
      name_en: text(p.name_en), area: text(p.area), address: text(p.address), hours: text(p.hours),
      instagram: text(cleanInstagram(p.instagram ?? "")), website: text(p.website), map_url: text(p.map_url),
      note: text(p.note), news_slug: text(p.news_slug),
      genres: Array.isArray(p.genres) ? p.genres.filter((g: unknown) => typeof g === "string") : [],
      starts_on: p.kind === "event" ? date(p.starts_on) : null,
      ends_on: p.kind === "event" ? date(p.ends_on) : null,
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
