"use client";
// 내 Collection 의 "Share" — 공개 스위치 + 링크 복사 + 아이디 바꾸기
// 공개하면 /collection/<아이디> 에서 누구나 Owned·Wishlist 를 볼 수 있음 (이메일·이름·사진은 안 보임)
import { useEffect, useId, useRef, useState } from "react";
import { fetchMyShare, saveMyShare, HANDLE_RULE } from "@/lib/collectionShare";
import { SITE } from "@/lib/site";

const SERIF = "font-['Grooves_Display','Hahmlet',Georgia,serif]";
const ERRORS = {
  handle_taken: "That ID is taken. Try another.",
  handle_invalid: "Use 3–24 characters: a–z, 0–9, _ and -.",
  failed: "Couldn’t save. Please try again.",
};

export default function ShareCollection({ user }) {
  const [share, setShare] = useState(undefined);   // undefined = 불러오는 중, null = 아직 준비 안 됨
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState(false);
  const boxRef = useRef(null);
  const panelId = useId();

  useEffect(() => {
    let alive = true;
    fetchMyShare(user.id).then((s) => { if (alive) { setShare(s); setDraft(s?.handle ?? ""); } }, () => { if (alive) setShare(null); });
    return () => { alive = false; };
  }, [user.id]);

  // 바깥을 누르거나 Esc → 닫힘
  useEffect(() => {
    if (!open) return;
    const away = (e) => { if (!boxRef.current?.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("pointerdown", away); document.removeEventListener("keydown", esc); };
  }, [open]);

  if (share === undefined) return null;
  const link = share ? `${SITE.url}/collection/${share.handle}` : "";
  const shortLink = link.replace(/^https?:\/\//, "");

  async function save(patch) {
    setBusy(true); setMessage("");
    try {
      const next = await saveMyShare(patch);
      setShare(next); setDraft(next.handle);
    } catch (e) {
      setMessage(ERRORS[e.code] ?? ERRORS.failed);
    } finally { setBusy(false); }
  }
  async function copy() {
    try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1600); } catch {}
  }
  const cleanDraft = draft.trim().toLowerCase();
  const draftOk = HANDLE_RULE.test(cleanDraft);

  return (
    <div ref={boxRef} className="relative shrink-0">
      <button type="button" aria-expanded={open} aria-controls={panelId} onClick={() => setOpen((o) => !o)}
        className="inline-flex min-h-9 items-center gap-2 rounded-full border border-(--ink)/25 px-3.5 text-(--ink) transition-colors hover:border-(--ink) aria-expanded:border-(--ink)">
        <span aria-hidden="true" className={`size-1.5 rounded-full ${share?.isPublic ? "bg-(--accent)" : "bg-(--ink)/30"}`} />
        {share?.isPublic ? "Shared" : "Share"}
      </button>

      {open && (
        <div id={panelId} role="dialog" aria-label="Share your collection"
          className="absolute right-0 top-[calc(100%+0.6rem)] z-30 w-[min(22rem,calc(100vw-2.5rem))] rounded-2xl border border-(--ink)/15 bg-(--cream) p-5 normal-case tracking-normal text-(--ink) shadow-[0_18px_40px_-12px_rgba(42,34,42,0.35)] transition-[opacity,translate] duration-300 starting:-translate-y-1 starting:opacity-0">
          {!share ? (
            <p className="text-[14px] leading-6 text-(--ink)/70">Sharing isn’t available yet. Please try again later.</p>
          ) : (
            <>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className={`${SERIF} text-[1.35rem] font-black leading-tight`}>Share your shelf</p>
                  <p className="mt-1.5 text-[13px] leading-5 text-(--ink)/65">Anyone with the link can see your Owned and Wishlist records. Your email, name and photo stay private.</p>
                </div>
                {/* 공개 스위치 */}
                <button type="button" role="switch" aria-checked={share.isPublic} aria-label="Share my collection" disabled={busy}
                  onClick={() => save({ isPublic: !share.isPublic })}
                  className="relative mt-1 h-7 w-12 shrink-0 rounded-full bg-(--ink)/20 transition-colors aria-checked:bg-(--accent) disabled:opacity-60">
                  <span aria-hidden="true" className={`absolute top-1 left-1 size-5 rounded-full bg-(--cream) shadow transition-transform duration-300 ${share.isPublic ? "translate-x-5" : ""}`} />
                </button>
              </div>

              {share.isPublic && (
                <div className="mt-4 flex items-center gap-2 rounded-xl border border-(--ink)/15 py-1.5 pr-1.5 pl-3">
                  <a href={link} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate text-[13px] underline-offset-4 hover:underline">{shortLink}</a>
                  <button type="button" onClick={copy}
                    className="inline-flex min-h-9 shrink-0 items-center rounded-full bg-(--ink) px-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-(--cream) transition-colors hover:bg-(--accent)">
                    {copied ? "Copied" : "Copy"}
                  </button>
                </div>
              )}

              {/* 아이디 바꾸기 */}
              <form className="mt-4" onSubmit={(e) => { e.preventDefault(); if (draftOk && cleanDraft !== share.handle) save({ handle: cleanDraft }); }}>
                <label htmlFor={`${panelId}-id`} className="text-[10px] font-medium uppercase tracking-[0.24em] text-(--ink)/60">Your ID</label>
                <div className="mt-1.5 flex items-center gap-2">
                  <div className="flex min-w-0 flex-1 items-center rounded-xl border border-(--ink)/15 px-3 focus-within:border-(--ink)">
                    <span className="shrink-0 text-[13px] text-(--ink)/45">collection/</span>
                    <input id={`${panelId}-id`} value={draft} onChange={(e) => { setDraft(e.target.value); setMessage(""); }}
                      autoComplete="off" spellCheck={false} maxLength={24}
                      className="min-h-10 min-w-0 flex-1 bg-transparent text-[13px] outline-none" />
                  </div>
                  <button type="submit" disabled={busy || !draftOk || cleanDraft === share.handle}
                    className="inline-flex min-h-10 shrink-0 items-center rounded-full border border-(--ink) px-4 text-[11px] font-semibold uppercase tracking-[0.16em] transition-colors hover:bg-(--ink) hover:text-(--cream) disabled:pointer-events-none disabled:opacity-35">
                    Save
                  </button>
                </div>
                <p className="mt-2 min-h-5 text-[12px] leading-5 text-(--ink)/60" role="status">
                  {message || (draft && !draftOk ? ERRORS.handle_invalid : "")}
                </p>
              </form>
            </>
          )}
        </div>
      )}
    </div>
  );
}
