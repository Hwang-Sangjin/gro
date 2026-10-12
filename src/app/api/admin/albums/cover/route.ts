// src/app/api/admin/albums/cover/route.ts
// 커버만 교체. 트랙·아티스트·장르는 건드리지 않는다.
//
// POST multipart/form-data — 관리자만
//   slug:   교체할 앨범 slug
//   cover:  새 이미지 파일

import { processCover, removeOldCovers } from "@/lib/admin/cover";
import { adminGuard, serviceClient } from "@/lib/admin/auth";

export const runtime = "nodejs";

const supabase = serviceClient();

export async function POST(req: Request) {
  try {
    const denied = await adminGuard();
    if (denied) return denied;
    const form = await req.formData();

    const slug = String(form.get("slug") ?? "").trim();
    const cover = form.get("cover");

    if (!slug)
      return Response.json({ error: "A slug is required." }, { status: 400 });
    if (!(cover instanceof File) || cover.size === 0) {
      return Response.json(
        { error: "Choose a cover image." },
        { status: 400 },
      );
    }

    const { data: album, error: findErr } = await supabase
      .from("albums")
      .select("id, title, cover_path, thumb_path")
      .eq("slug", slug)
      .maybeSingle();

    if (findErr) throw new Error(findErr.message);
    if (!album)
      return Response.json(
        { error: `No album with slug '${slug}'.` },
        { status: 404 },
      );

    const image = await processCover(supabase, cover, slug);

    const { error: updErr } = await supabase
      .from("albums")
      .update(image)
      .eq("id", album.id);
    if (updErr) throw new Error(`Couldn’t update the album: ${updErr.message}`);

    // 새 이미지로 바뀐 뒤에 이전 파일을 지운다
    if (album.cover_path !== image.cover_path) {
      await removeOldCovers(supabase, [album.cover_path, album.thumb_path]);
    }

    return Response.json({
      ok: true,
      title: album.title,
      coverColor: image.cover_color,
    });
  } catch (e: any) {
    return Response.json(
      { error: e.message ?? "Unknown error" },
      { status: 500 },
    );
  }
}
