// 앨범 공유 미리보기 이미지 (카톡·SNS 링크 카드): 대표 색 바탕 + 제목·아티스트 + 슬리브에서 반쯤 나온 판
import { ImageResponse } from "next/og";
import { publicClient } from "@/lib/publicSupabase";
import { coverUrl } from "@/lib/albums";
import { OG_SIZE, OG_FAMILY, CREAM, INK, ACCENT, coverData, ogFonts, inkOn, Disc } from "@/lib/og";

export const alt = "A record on Grooves";
export const size = OG_SIZE;
export const contentType = "image/png";
export const revalidate = 3600;

export default async function Image({ params }) {
  const { id: slug } = await params;
  let a = null;
  try {
    ({ data: a } = await publicClient().from("albums")
      .select("title, artist_names, cover_path, thumb_path, cover_color, release_year, format, label")
      .eq("slug", slug).eq("status", "published").maybeSingle());
  } catch {}

  const bg = a?.cover_color || CREAM, fg = inkOn(bg);
  const title = a?.title || "A record on Grooves", artist = a?.artist_names || "";
  const meta = a ? [a.release_year, a.format, a.label].filter(Boolean).join(" · ") : "Records, people, culture";
  const [cover, fonts] = await Promise.all([
    coverData(coverUrl(a?.cover_path || a?.thumb_path), 860),
    ogFonts(`${title}${artist}${meta}`),
  ]);
  const T = 430;   // 슬리브 한 변
  const long = title.length > 26, veryLong = title.length > 44;

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: bg, color: fg, fontFamily: OG_FAMILY, position: "relative", overflow: "hidden" }}>
        {/* 바탕에 은은한 빛 */}
        <div style={{ position: "absolute", inset: 0, display: "flex", backgroundImage: "radial-gradient(circle at 78% 50%, rgba(255,255,255,0.16), rgba(0,0,0,0.12) 70%)" }} />

        {/* 왼쪽: 글자 */}
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "60px 0 58px 72px", width: 560, position: "relative" }}>
          <div style={{ display: "flex", fontSize: 36, fontWeight: 900, letterSpacing: -1 }}>Grooves</div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", fontSize: 20, fontWeight: 500, letterSpacing: 6, textTransform: "uppercase", color: fg === INK ? ACCENT : CREAM, opacity: fg === INK ? 1 : 0.75 }}>Now spinning</div>
            <div style={{ display: "flex", fontSize: veryLong ? 46 : long ? 56 : 72, fontWeight: 900, lineHeight: 1.02, letterSpacing: -1.5, marginTop: 14, maxHeight: 300, overflow: "hidden" }}>{title}</div>
            {artist && <div style={{ display: "flex", fontSize: 30, fontWeight: 500, marginTop: 20 }}>{artist}</div>}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 18, fontSize: 20, fontWeight: 500, letterSpacing: 3, textTransform: "uppercase", opacity: 0.7 }}>
            <div style={{ display: "flex", height: 3, width: 64, background: fg }} />
            {meta}
          </div>
        </div>

        {/* 오른쪽: 슬리브 + 오른쪽으로 반쯤 나온 판 */}
        <div style={{ display: "flex", position: "relative", flex: 1, height: "100%" }}>
          <Disc size={T - 16} label={a?.cover_color || ACCENT} style={{ left: 152, top: (630 - T) / 2 + 8 }} />
          <div style={{
            position: "absolute", display: "flex", left: 20, top: (630 - T) / 2, width: T, height: T,
            background: a?.cover_color || INK, boxShadow: "0 30px 60px rgba(20,14,18,0.38)", overflow: "hidden",
          }}>
            {cover && <img src={cover} width={T} height={T} style={{ objectFit: "cover" }} />}
          </div>
        </div>
      </div>
    ),
    { ...size, fonts },
  );
}
