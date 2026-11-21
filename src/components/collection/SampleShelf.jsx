"use client";
// 로그인 전 Collection 화면의 견본 선반 — 공개된 선반 하나(SITE.featuredShelf)의 앞 몇 장을 미리 보여 줌
//  예전: 제목 · 한 문장 · 로그인 버튼뿐이라 화면 대부분이 빈 종이였고, 로그인하지 않으면 선반이 어떻게 생겼는지 알 수 없었음
//  그 선반이 비공개로 바뀌거나 못 불러오면 아무것도 그리지 않음 (예전 화면 그대로)
import { useEffect, useState } from "react";
import Link from "next/link";
import AlbumGrid from "@/components/albums/AlbumGrid";
import { createClient } from "@/utils/supabase/client";
import { cached } from "@/lib/dataCache";

const SHOW = 8;   // 미리 보여 줄 판 수 (넓은 화면에서 두 줄 — 둘째 줄은 아래로 옅어짐)

// 공개 선반 (public_collection RPC — /collection/<아이디> 페이지와 같은 데이터). 10분 동안은 저장해 둔 것을 씀
//  keep 을 30분으로 짧게: 주인이 선반을 비공개로 돌리면 이 브라우저에 저장된 것도 곧 버려지게 (기본값은 하루)
function fetchShelf(handle) {
  return cached(`sample-shelf:${handle}`, async () => {
    const { data, error } = await createClient().rpc("public_collection", { p_handle: handle });
    if (error) throw error;
    return data?.handle ? { handle: data.handle, owned: data.owned ?? [], wishlist: data.wishlist ?? [] } : null;
  }, { fresh: 10 * 60_000, keep: 30 * 60_000, valid: (d) => !!d?.owned?.length }).catch(() => null);
}

export default function SampleShelf({ handle }) {
  const [shelf, setShelf] = useState(null);
  useEffect(() => {
    if (!handle) return;
    let alive = true;
    fetchShelf(handle).then((d) => { if (alive) setShelf(d); });
    return () => { alive = false; };
  }, [handle]);
  if (!shelf?.owned.length) return null;

  // created_at 은 "선반에 담은 날" → added_at 으로 (그대로 두면 카드가 NEW IN 스티커를 붙임)
  const albums = shelf.owned.slice(0, SHOW).map(({ created_at, ...album }) => ({ ...album, added_at: created_at }));
  const n = shelf.owned.length, w = shelf.wishlist.length;
  const href = `/collection/${shelf.handle}`;

  return (
    <section aria-labelledby="sample-shelf-label" className="mt-[clamp(3rem,7vw,6rem)]">
      {/* 선반 머리줄: 실제 선반(ShelfBrowser)과 같은 모양 */}
      <div className="flex min-h-9 flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t-[3px] border-(--ink) pt-3 text-[10px] font-medium uppercase tracking-[0.3em] text-(--ink)/60">
        <span id="sample-shelf-label" className="min-w-0 truncate">A shelf on Grooves · @{shelf.handle}</span>
        <span className="tabular-nums">{n} owned{w ? ` · ${w} on the wishlist` : ""}</span>
      </div>
      {/* 앞 몇 장만: 아래로 갈수록 종이에 스며들 듯 옅어짐 (전체는 그 선반 페이지에서) */}
      <div className="mt-[clamp(1.25rem,2.4vw,2rem)]"
        style={{ maskImage: "linear-gradient(to bottom, #000 52%, transparent 96%)", WebkitMaskImage: "linear-gradient(to bottom, #000 52%, transparent 96%)" }}>
        <AlbumGrid albums={albums} aria-label={`Records on @${shelf.handle}’s shelf`} />
      </div>
      <div className="-mt-6 flex justify-center">
        <Link href={href}
          className="relative inline-flex min-h-12 items-center gap-2 rounded-full border border-(--ink) bg-(--bg) px-7 text-[13px] font-medium uppercase tracking-[0.18em] transition-colors hover:bg-(--ink) hover:text-(--cream)">
          See the whole shelf <span aria-hidden="true">→</span>
        </Link>
      </div>
    </section>
  );
}
