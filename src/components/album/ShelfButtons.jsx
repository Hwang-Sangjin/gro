"use client";
// 앨범 상세: 내 컬렉션(소장) / 위시리스트에 담기·빼기
// 한 앨범은 둘 중 한 칸에만 — 위시리스트에 있던 판을 "소장"으로 누르면 옮겨짐
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import useAuthUser from "@/lib/useAuthUser";
import { fetchAlbumKind, setAlbumKind } from "@/lib/userAlbums";

const OPTIONS = [
  { kind: "owned", on: "소장 중", off: "소장하기", icon: "disc" },
  { kind: "wishlist", on: "위시리스트에 있음", off: "위시리스트", icon: "heart" },
];

function Icon({ name, filled }) {
  if (name === "heart") return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className="size-4" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round">
      <path d="M8 13.5S2 10 2 5.9A3 3 0 0 1 8 4.4a3 3 0 0 1 6 1.5C14 10 8 13.5 8 13.5Z" />
    </svg>
  );
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.4">
      <circle cx="8" cy="8" r="6" fill={filled ? "currentColor" : "none"} />
      <circle cx="8" cy="8" r="1.6" fill={filled ? "var(--shelf-bg)" : "none"} stroke={filled ? "var(--shelf-bg)" : "currentColor"} />
    </svg>
  );
}

export default function ShelfButtons({ albumId, slug, ink, color }) {
  const user = useAuthUser();
  const router = useRouter();
  const [kind, setKind] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) { setKind(null); return; }
    let alive = true;
    fetchAlbumKind(albumId).then(k => { if (alive) setKind(k); }).catch(() => {});
    return () => { alive = false; };
  }, [user, albumId]);

  async function toggle(next) {
    if (user === undefined || busy) return;
    if (!user) { router.push(`/login?next=${encodeURIComponent(`/album/${slug}`)}`); return; }
    const prev = kind;
    const target = prev === next ? null : next;
    setKind(target); setBusy(true); setError("");          // 먼저 화면에 반영, 실패하면 되돌림
    try { await setAlbumKind(user.id, albumId, target); }
    catch { setKind(prev); setError("저장하지 못했어요. 잠시 후 다시 시도해 주세요."); }
    finally { setBusy(false); }
  }

  return (
    <div className="mt-8" style={{ "--shelf-bg": color }}>
      <div className="flex flex-wrap gap-2.5" role="group" aria-label="내 판에 담기">
        {OPTIONS.map(o => {
          const on = kind === o.kind;
          return (
            <button key={o.kind} type="button" aria-pressed={on} disabled={user === undefined} onClick={() => toggle(o.kind)}
              className="inline-flex min-h-11 items-center gap-2 rounded-full border border-current/35 px-5 text-[13px] font-medium tracking-[.04em] transition-[background-color,color,border-color,scale] duration-300 hover:border-current active:scale-[.97] disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-4"
              style={on ? { backgroundColor: ink, color, borderColor: ink } : undefined}>
              <Icon name={o.icon} filled={on} />
              {on ? o.on : o.off}
            </button>
          );
        })}
      </div>
      <p role="status" className="mt-2 min-h-5 text-[12px] text-[var(--album-muted)]">
        {error || (user === null ? "로그인하면 내 컬렉션에 담을 수 있어요." : "")}
      </p>
    </div>
  );
}
