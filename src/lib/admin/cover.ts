// src/lib/admin/cover.ts
// 커버 이미지 처리 — 등록 API 와 커버 교체 API 가 같이 쓴다. 서버 전용.

import sharp from "sharp";
import type { SupabaseClient } from "@supabase/supabase-js";

const BUCKET = "album-covers";
const MIN_SIZE = 500; // 이보다 작은 원본은 거부

const toHex = ({ r, g, b }: { r: number; g: number; b: number }) =>
  "#" +
  [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");

export async function processCover(
  supabase: SupabaseClient,
  file: File,
  slug: string,
) {
  const buf = Buffer.from(await file.arrayBuffer());

  const { width = 0, height = 0 } = await sharp(buf).metadata();
  if (Math.min(width, height) < MIN_SIZE) {
    throw new Error(
      `커버 이미지가 너무 작습니다 (${width}×${height}). 최소 ${MIN_SIZE}px 이상이어야 합니다.`,
    );
  }

  const [cover, thumb, lqip, stats] = await Promise.all([
    sharp(buf)
      .resize(1200, 1200, { fit: "cover" })
      .webp({ quality: 88 })
      .toBuffer(),
    // 레티나 화면에서 카드 폭(약 300~450 CSS px)을 채우려면 800px 이 필요하다
    sharp(buf)
      .resize(800, 800, { fit: "cover" })
      .webp({ quality: 78 })
      .toBuffer(),
    sharp(buf)
      .resize(16, 16, { fit: "cover" })
      .webp({ quality: 40 })
      .toBuffer(),
    sharp(buf).stats(),
  ]);

  // 파일명에 버전을 붙여 브라우저·CDN 캐시에 옛 이미지가 남지 않게 한다
  const v = Date.now().toString(36);
  const coverPath = `${slug}/cover-${v}.webp`;
  const thumbPath = `${slug}/thumb-${v}.webp`;

  for (const [p, body] of [
    [coverPath, cover],
    [thumbPath, thumb],
  ] as const) {
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(p, body, { contentType: "image/webp", upsert: true });
    if (error) throw new Error(`커버 업로드 실패: ${error.message}`);
  }

  return {
    cover_path: coverPath,
    thumb_path: thumbPath,
    cover_color: toHex(stats.dominant),
    cover_lqip: `data:image/webp;base64,${lqip.toString("base64")}`,
  };
}

// 교체 후 이전 파일 정리
export async function removeOldCovers(
  supabase: SupabaseClient,
  paths: (string | null)[],
) {
  const targets = paths.filter(Boolean) as string[];
  if (targets.length) await supabase.storage.from(BUCKET).remove(targets);
}
