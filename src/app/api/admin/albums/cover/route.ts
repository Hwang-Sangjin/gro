// src/app/api/admin/albums/cover/route.ts
// 커버만 교체. 트랙·아티스트·장르는 건드리지 않는다.
//
// POST multipart/form-data
//   secret: ADMIN_SECRET
//   slug:   교체할 앨범 slug
//   cover:  새 이미지 파일

import { createClient } from "@supabase/supabase-js";
import { processCover, removeOldCovers } from "@/lib/admin/cover";

export const runtime = "nodejs";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

export async function POST(req: Request) {
  try {
    const form = await req.formData();

    if (form.get("secret") !== process.env.ADMIN_SECRET) {
      return Response.json(
        { error: "관리자 키가 올바르지 않습니다." },
        { status: 401 },
      );
    }

    const slug = String(form.get("slug") ?? "").trim();
    const cover = form.get("cover");

    if (!slug)
      return Response.json({ error: "slug 가 필요합니다." }, { status: 400 });
    if (!(cover instanceof File) || cover.size === 0) {
      return Response.json(
        { error: "커버 이미지를 선택하세요." },
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
        { error: `'${slug}' 앨범이 없습니다.` },
        { status: 404 },
      );

    const image = await processCover(supabase, cover, slug);

    const { error: updErr } = await supabase
      .from("albums")
      .update(image)
      .eq("id", album.id);
    if (updErr) throw new Error(`앨범 갱신 실패: ${updErr.message}`);

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
      { error: e.message ?? "알 수 없는 오류" },
      { status: 500 },
    );
  }
}
