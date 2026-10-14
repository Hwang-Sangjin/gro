// 공개 컬렉션 공유 미리보기 이미지 (카톡·SNS 링크 카드): 크림 종이 위 '@아이디’s shelf' + 커버 몇 장을 부채꼴로
import { ImageResponse } from "next/og";
import { publicClient } from "@/lib/publicSupabase";
import { coverUrl } from "@/lib/albums";
import { OG_FAMILY, coverData, ogFonts } from "@/lib/og";

export const alt = "A record collection on Grooves";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const revalidate = 3600;

const CREAM = "#f4e7cd", INK = "#4c404a", RUST = "#c8553d";

export default async function Image({ params }) {
  const { handle: raw } = await params;
  let handle = raw;
  try { handle = decodeURIComponent(raw); } catch {}
  handle = handle.trim().toLowerCase();

  let data = null;
  if (/^[a-z0-9][a-z0-9_-]{1,22}[a-z0-9]$/.test(handle)) {
    try { ({ data } = await publicClient().rpc("public_collection", { p_handle: handle })); } catch {}
  }
  const owned = data?.owned ?? [], wishlist = data?.wishlist ?? [];
  const covers = [...owned, ...wishlist].slice(0, 5);
  // 커버는 webp → next/og 가 못 그려서 jpeg 로 바꿔 넣음
  const [fonts, ...images] = await Promise.all([ogFonts(handle), ...covers.map((a) => coverData(coverUrl(a.thumb_path), 600))]);

  // 커버: 오른쪽에 부채꼴로 겹쳐 놓음 (없으면 대표 색 슬리브)
  const N = Math.max(covers.length, 3);
  const slots = Array.from({ length: N }, (_, i) => covers[i] ?? null);
  const card = 300;

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: CREAM, color: INK, fontFamily: OG_FAMILY, position: "relative" }}>
        {/* 왼쪽: 글자 */}
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "64px 0 60px 72px", width: 560 }}>
          <div style={{ display: "flex", fontSize: 40, fontWeight: 900, letterSpacing: -1 }}>Grooves</div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", fontSize: 22, fontWeight: 500, letterSpacing: 6, textTransform: "uppercase", color: RUST }}>Collection</div>
            <div style={{ display: "flex", fontSize: handle.length > 14 ? 58 : 76, fontWeight: 900, lineHeight: 1, letterSpacing: -2, marginTop: 14 }}>
              {data ? `@${data.handle}’s shelf` : "A shelf on Grooves"}
            </div>
            <div style={{ display: "flex", fontSize: 28, fontWeight: 500, marginTop: 22, opacity: 0.7 }}>
              {data ? `${owned.length} owned · ${wishlist.length} on the wishlist` : "Records, people, culture"}
            </div>
          </div>
          <div style={{ display: "flex", height: 4, width: 120, background: INK }} />
        </div>

        {/* 오른쪽: 커버 부채꼴 */}
        <div style={{ display: "flex", position: "relative", flex: 1, height: "100%" }}>
          {slots.map((a, i) => {
            const mid = (N - 1) / 2, k = i - mid;
            const src = images[i] ?? null;
            return (
              <div key={i} style={{
                position: "absolute", display: "flex", width: card, height: card,
                left: 120 + k * 74, top: 160 + Math.abs(k) * 14,
                transform: `rotate(${k * 7}deg)`,
                background: a?.cover_color || [INK, RUST, "#bbcbda", "#4f6d93", "#e3b04b"][i % 5],
                boxShadow: "0 24px 40px rgba(42,34,42,0.28)", borderRadius: 4, overflow: "hidden",
              }}>
                {src && <img src={src} width={card} height={card} style={{ objectFit: "cover" }} />}
              </div>
            );
          })}
        </div>
      </div>
    ),
    { ...size, fonts },
  );
}
