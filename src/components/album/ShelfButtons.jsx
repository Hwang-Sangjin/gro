"use client";
// 앨범 상세: 내 컬렉션(소장) / 위시리스트에 담기·빼기
// 한 앨범은 둘 중 한 칸에만 — 위시리스트에 있던 판을 "소장"으로 누르면 옮겨짐
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import useAuthUser from "@/lib/useAuthUser";
import { fetchAlbumKind, setAlbumKind, fetchOwnerCount } from "@/lib/userAlbums";

const OPTIONS = [
  { kind: "owned", on: "In your collection", off: "I own this", icon: "disc" },
  { kind: "wishlist", on: "On your wishlist", off: "Add to wishlist", icon: "heart" },
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
  const [owners, setOwners] = useState(null);   // 이 판을 소장한 사람 수 (null = 모름)

  useEffect(() => {
    let alive = true;
    fetchOwnerCount(albumId).then(n => { if (alive) setOwners(n); }).catch(() => {});
    return () => { alive = false; };
  }, [albumId]);

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
    const delta = (target === "owned" ? 1 : 0) - (prev === "owned" ? 1 : 0);
    setKind(target); setBusy(true); setError("");          // 먼저 화면에 반영, 실패하면 되돌림
    setOwners(n => (n == null ? n : Math.max(0, n + delta)));
    try { await setAlbumKind(user.id, albumId, target); }
    catch { setKind(prev); setOwners(n => (n == null ? n : Math.max(0, n - delta))); setError("Couldn’t save that. Please try again in a moment."); }
    finally { setBusy(false); }
  }

  return (
    <div className="mt-8" style={{ "--shelf-bg": color }}>
      <div className="flex flex-wrap gap-2.5" role="group" aria-label="Add to my shelves">
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
      {/* 소장자 수 */}
      {owners != null && (
        <p className="mt-3 flex items-center gap-2 text-[13px] tracking-[.02em] transition-opacity duration-500 starting:opacity-0">
          <span aria-hidden="true" className="flex -space-x-1.5">
            {Array.from({ length: Math.min(3, Math.max(1, owners)) }, (_, i) => (
              <span key={i} className="size-4 rounded-full border border-current/40" style={{ backgroundColor: owners ? ink : "transparent", opacity: 1 - i * 0.22 }} />
            ))}
          </span>
          <span>
            {owners === 0 ? "No one has this on their shelf yet — be the first."
              : owners === 1 ? (kind === "owned" ? "You’re the only one with this on the shelf." : "1 collector has this on the shelf.")
              : `${owners.toLocaleString("en-US")} collectors have this on the shelf.`}
          </span>
        </p>
      )}
      <p role="status" className="mt-2 min-h-5 text-[12px] text-[var(--album-muted)]">
        {error || (user === null ? "Log in to add records to your collection." : "")}
      </p>
    </div>
  );
}
