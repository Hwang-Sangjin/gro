// 사이트 대표 공유 이미지 (홈, 그리고 따로 이미지가 없는 페이지 전부): 크림 종이 + 로고 + 큰 판 + 최근 앨범 몇 장
import { ImageResponse } from "next/og";
import { publicClient } from "@/lib/publicSupabase";
import { coverUrl } from "@/lib/albums";
import { OG_SIZE, OG_FAMILY, CREAM, INK, RUST, coverData, ogFonts, Disc } from "@/lib/og";

export const alt = "Grooves — vinyl digging for record collectors";
export const size = OG_SIZE;
export const contentType = "image/png";
export const revalidate = 86400;

export default async function Image() {
  let albums = [];
  try {
    ({ data: albums } = await publicClient().from("albums")
      .select("thumb_path, cover_path, cover_color")
      .eq("status", "published").order("created_at", { ascending: false }).limit(3));
  } catch {}
  albums = albums ?? [];
  const [fonts, ...covers] = await Promise.all([
    ogFonts(""),
    ...albums.map((a) => coverData(coverUrl(a.cover_path || a.thumb_path), 520)),
  ]);
  const C = 230;
  const fallback = [RUST, "#4f6d93", "#e3b04b"];

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: CREAM, color: INK, fontFamily: OG_FAMILY, position: "relative", overflow: "hidden" }}>
        {/* 오른쪽 가장자리로 걸친 큰 판 */}
        <Disc size={760} label={RUST} style={{ left: 700, top: -65 }} />

        {/* 글자 */}
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "64px 0 60px 72px", width: 640, position: "relative" }}>
          <div style={{ display: "flex", fontSize: 22, fontWeight: 500, letterSpacing: 7, textTransform: "uppercase", color: RUST }}>Records · People · Culture</div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", fontSize: 150, fontWeight: 900, lineHeight: 0.9, letterSpacing: -5 }}>Grooves</div>
            <div style={{ display: "flex", fontSize: 34, fontWeight: 500, marginTop: 26, lineHeight: 1.2, maxWidth: 520 }}>Vinyl digging for record collectors.</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 18, fontSize: 20, fontWeight: 500, letterSpacing: 4, textTransform: "uppercase", opacity: 0.7 }}>
            <div style={{ display: "flex", height: 3, width: 64, background: INK }} />
            Dig · Listen · Collect
          </div>
        </div>

        {/* 판 앞으로 겹쳐 선 최근 앨범들 */}
        {[0, 1, 2].map((i) => (
          <div key={i} style={{
            position: "absolute", display: "flex", width: C, height: C,
            left: 724 + i * 118, top: 318 - i * 74 + (i === 1 ? 8 : 0),
            transform: `rotate(${(i - 1) * 6}deg)`,
            background: albums[i]?.cover_color || fallback[i],
            boxShadow: "0 24px 44px rgba(30,24,28,0.32)", overflow: "hidden",
          }}>
            {covers[i] && <img src={covers[i]} width={C} height={C} style={{ objectFit: "cover" }} />}
          </div>
        ))}
      </div>
    ),
    { ...size, fonts },
  );
}
