// src/app/api/admin/albums/route.ts
//
// POST multipart/form-data
//   cover: File
//   payload: JSON string (아래 shape)
//   secret: string (ADMIN_SECRET)

import { createClient } from "@supabase/supabase-js";
import { processCover } from "@/lib/admin/cover";

export const runtime = "nodejs";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9가-힣]+/g, "-")
    .replace(/^-+|-+$/g, "");

// side 로 disc 추정: A,B -> 1 / C,D -> 2 / E,F -> 3 ...
const discFromSide = (side: string) =>
  Math.floor((side.charCodeAt(0) - 65) / 2) + 1;

const YT_ID = /^[A-Za-z0-9_-]+$/;

// 플레이리스트 링크를 넣어도 list= 값만 뽑아낸다
// https://www.youtube.com/watch?v=xxx&list=OLAK5uy_...&index=2 → OLAK5uy_...
function toPlaylistId(value?: string | null) {
  if (!value) return null;
  const v = value.trim();
  try {
    return new URL(v).searchParams.get("list");
  } catch {
    return YT_ID.test(v) ? v : null;
  }
}

// 영상 링크를 넣어도 영상 ID만 뽑아낸다
// https://www.youtube.com/watch?v=xxx / https://youtu.be/xxx → xxx
function toVideoId(value?: string | null) {
  if (!value) return null;
  const v = value.trim();
  try {
    const url = new URL(v);
    if (url.hostname === "youtu.be") return url.pathname.slice(1) || null;
    return url.searchParams.get("v");
  } catch {
    return YT_ID.test(v) ? v : null;
  }
}

async function upsertArtist(name: string) {
  const { data, error } = await supabase
    .from("artists")
    .upsert({ slug: slugify(name), name }, { onConflict: "slug" })
    .select("id")
    .single();
  if (error) throw new Error(`아티스트 실패 (${name}): ${error.message}`);
  return data.id as string;
}

export async function POST(req: Request) {
  try {
    const form = await req.formData();

    if (form.get("secret") !== process.env.ADMIN_SECRET) {
      return Response.json(
        { error: "관리자 키가 올바르지 않습니다." },
        { status: 401 },
      );
    }

    const payload = JSON.parse(String(form.get("payload") ?? "{}"));
    const cover = form.get("cover");

    if (!payload.slug || !payload.title || !payload.artists?.length) {
      return Response.json(
        { error: "slug, title, artist 는 필수입니다." },
        { status: 400 },
      );
    }
    if (!(cover instanceof File) || cover.size === 0) {
      return Response.json(
        { error: "커버 이미지를 선택하세요." },
        { status: 400 },
      );
    }

    const releaseDate: string | null = payload.releaseDate || null;
    const releaseYear = releaseDate
      ? Number(releaseDate.slice(0, 4))
      : Number(payload.releaseYear);
    if (!releaseYear) {
      return Response.json(
        { error: "발매 연도가 필요합니다." },
        { status: 400 },
      );
    }

    // 링크 형태가 잘못됐으면 커버를 올리기 전에 막는다
    const playlistId = toPlaylistId(payload.youtubePlaylistId);
    if (payload.youtubePlaylistId && !playlistId) {
      return Response.json(
        { error: "YouTube 플레이리스트 링크 또는 ID를 확인해주세요." },
        { status: 400 },
      );
    }

    const image = await processCover(supabase, cover, payload.slug);

    const { data: row, error } = await supabase
      .from("albums")
      .upsert(
        {
          slug: payload.slug,
          title: payload.title,
          release_date: releaseDate,
          release_year: releaseYear,
          format: payload.format || "LP",
          rpm: payload.rpm ?? 33,
          label: payload.label || null,
          catalog_no: payload.catalogNo || null,
          is_reissue: !!payload.isReissue,
          description: payload.description || null,
          youtube_playlist_id: playlistId,
          status: payload.status || "published",
          ...image,
        },
        { onConflict: "slug" },
      )
      .select("id")
      .single();
    if (error) throw new Error(`앨범 저장 실패: ${error.message}`);

    const albumId = row.id as string;

    // 아티스트
    const artistIds: string[] = [];
    for (const name of payload.artists)
      artistIds.push(await upsertArtist(name));

    await supabase.from("album_artists").delete().eq("album_id", albumId);
    await supabase.from("album_artists").insert(
      artistIds.map((id, i) => ({
        album_id: albumId,
        artist_id: id,
        position: i,
      })),
    );

    // 장르
    await supabase.from("album_genres").delete().eq("album_id", albumId);
    if (payload.genres?.length) {
      const { data: genres } = await supabase
        .from("genres")
        .select("id, slug")
        .in("slug", payload.genres);
      if (genres?.length) {
        await supabase
          .from("album_genres")
          .insert(genres.map((g) => ({ album_id: albumId, genre_id: g.id })));
      }
    }

    // 트랙 — side 안에서 순서대로 side_position 부여
    await supabase.from("tracks").delete().eq("album_id", albumId);
    if (payload.tracks?.length) {
      const counter: Record<string, number> = {};
      const rows = payload.tracks.map((t: any) => {
        const disc = t.disc ?? discFromSide(t.side);
        const key = `${disc}-${t.side}`;
        counter[key] = (counter[key] ?? 0) + 1;
        return {
          album_id: albumId,
          disc_no: disc,
          side: t.side,
          side_position: counter[key],
          title: t.title,
          duration_sec: t.duration ?? null,
          youtube_video_id: toVideoId(t.youtubeId),
        };
      });
      const { error: tErr } = await supabase.from("tracks").insert(rows);
      if (tErr) throw new Error(`트랙 저장 실패: ${tErr.message}`);
    }

    return Response.json({
      ok: true,
      id: albumId,
      slug: payload.slug,
      coverColor: image.cover_color,
      trackCount: payload.tracks?.length ?? 0,
    });
  } catch (e: any) {
    return Response.json(
      { error: e.message ?? "알 수 없는 오류" },
      { status: 500 },
    );
  }
}
