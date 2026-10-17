"use client";
// 내 계정: 프로필(Google) · 내 판 숫자 · 로그아웃 · 계정 삭제
// 삭제: 지워지는 것 안내 → 대화상자에서 DELETE 입력 → /api/account/delete → 이 브라우저 세션 정리 → 끝 화면
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import PageShell from "@/components/layout/PageShell";
import Reveal, { RiseText } from "@/components/story/Reveal";
import useAuthUser, { authClient, profileOf, signOut, useIsAdmin } from "@/lib/useAuthUser";
import { formatDate } from "@/content/news";
import { SITE } from "@/lib/site";

const SERIF = "font-['Grooves_Bodoni',Georgia,serif] font-black tracking-[-0.035em]";
const WRAP = "mx-auto w-full max-w-[1100px] px-[clamp(20px,4vw,72px)]";
const BTN = "inline-flex min-h-11 items-center justify-center rounded-full px-6 text-[12px] font-medium uppercase tracking-[0.18em] transition-colors";

function useCounts(user) {
  const [counts, setCounts] = useState(null);
  useEffect(() => {
    if (!user) { setCounts(null); return; }
    let alive = true;
    const db = authClient();
    Promise.all([
      db.from("user_albums").select("kind"),
      db.from("album_requests").select("id", { count: "exact", head: true }),
    ]).then(([shelf, req]) => {
      if (!alive) return;
      const rows = shelf.data ?? [];
      setCounts({
        owned: rows.filter((r) => r.kind === "owned").length,
        wishlist: rows.filter((r) => r.kind === "wishlist").length,
        requests: req.count ?? 0,
      });
    }, () => alive && setCounts({ owned: 0, wishlist: 0, requests: 0 }));
    return () => { alive = false; };
  }, [user]);
  return counts;
}

function DeleteDialog({ dialogRef, counts, onDeleted }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [closing, setClosing] = useState(false);
  const ok = text.trim().toUpperCase() === "DELETE";

  const close = () => {
    if (busy) return;
    const d = dialogRef.current;
    if (!d?.open) return;
    setClosing(true);
    const done = () => { clearTimeout(t); d.removeEventListener("animationend", end); setClosing(false); d.close(); setText(""); setError(""); };
    const end = (e) => { if (e.animationName === "sheet-down") done(); };
    const t = setTimeout(done, 1200);
    d.addEventListener("animationend", end);
  };

  async function confirm(e) {
    e.preventDefault();
    if (!ok || busy) return;
    setBusy(true); setError("");
    try {
      const res = await fetch("/api/account/delete", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ confirm: "DELETE" }) });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Something went wrong. Please try again.");
      await authClient().auth.signOut({ scope: "local" }).catch(() => {});
      dialogRef.current?.close();
      onDeleted();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <dialog ref={dialogRef} data-closing={closing} aria-labelledby="del-title" data-lenis-prevent
      onCancel={(e) => { e.preventDefault(); close(); }}
      onClick={(e) => { if (e.target === e.currentTarget) close(); }}
      className="m-auto mb-0 w-full max-w-[560px] bg-transparent p-0 text-(--ink) backdrop:bg-[#1b1619]/45 backdrop:backdrop-blur-[3px] open:animate-[sheet-up_.6s_cubic-bezier(.22,1,.36,1)_both] data-[closing=true]:animate-[sheet-down_.45s_cubic-bezier(.55,0,.75,.2)_both] open:backdrop:animate-[veil-in_.4s_ease_both] data-[closing=true]:backdrop:animate-[veil-out_.45s_ease_both] sm:mb-auto">
      <form onSubmit={confirm} className="rounded-t-[28px] bg-(--cream) p-[clamp(1.5rem,4vw,2.25rem)] shadow-[0_-20px_60px_-20px_rgba(0,0,0,.4)] sm:rounded-[28px]">
        <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-(--danger)">Delete account</p>
        <h2 id="del-title" className={`${SERIF} mt-2 text-[clamp(2rem,5vw,2.6rem)] leading-[0.95]`}>This can’t be undone.</h2>
        <p className="mt-4 text-[15px] leading-7 text-(--ink)/80">
          Your account will be deleted right away
          {counts ? <>, along with <b className="font-medium text-(--ink)">{counts.owned} owned</b>, <b className="font-medium text-(--ink)">{counts.wishlist} wishlist</b> and <b className="font-medium text-(--ink)">{counts.requests} request{counts.requests === 1 ? "" : "s"}</b></> : null}.
        </p>
        <label htmlFor="del-confirm" className="mt-6 block text-[11px] font-medium uppercase tracking-[0.22em] text-(--ink)/60">Type DELETE to confirm</label>
        <input id="del-confirm" value={text} onChange={(e) => setText(e.target.value)} autoComplete="off" spellCheck={false} disabled={busy}
          className="mt-2 w-full rounded-xl border border-(--ink)/25 bg-transparent px-4 py-3 text-[16px] uppercase tracking-[0.2em] outline-none transition-colors placeholder:text-(--ink)/30 focus:border-(--ink)" placeholder="DELETE" />
        {error && <p role="alert" className="mt-3 text-[14px] text-(--danger)">{error}</p>}
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <button type="button" onClick={close} disabled={busy} className={`${BTN} border border-(--ink)/30 hover:border-(--ink) disabled:opacity-40`}>Keep my account</button>
          <button type="submit" disabled={!ok || busy} className={`${BTN} bg-(--danger) text-(--cream) hover:bg-(--danger)/85 disabled:cursor-not-allowed disabled:opacity-40`}>
            {busy ? "Deleting…" : "Delete forever"}
          </button>
        </div>
      </form>
    </dialog>
  );
}

export default function AccountView() {
  const user = useAuthUser();
  const admin = useIsAdmin(user);
  const counts = useCounts(user);
  const dialog = useRef(null);
  const [deleted, setDeleted] = useState(false);
  const p = profileOf(user);
  // 삭제 끝 화면은 맨 위부터 (같은 스크롤 컨테이너를 그대로 써서 위치가 남아 있음)
  const doneRef = useRef(null);
  useEffect(() => { if (deleted) doneRef.current?.closest(".page")?.scrollTo({ top: 0 }); }, [deleted]);

  if (deleted) {
    return (
      <PageShell className="paper-textured">
        <section ref={doneRef} className={`${WRAP} grid min-h-[60svh] place-content-center text-center text-(--ink)`}>
          <RiseText as="h1" lines={["Your account", "has been deleted."]} className={`${SERIF} text-[clamp(2.6rem,6vw,5rem)] leading-[0.92]`} />
          <p className="mx-auto mt-5 max-w-md text-[15px] leading-7 text-(--ink)/70">Thanks for digging with us. You can still browse {SITE.name} any time, and you’re always welcome back.</p>
          <Link href="/" className={`${BTN} mx-auto mt-8 bg-(--ink) px-8 text-(--cream) hover:bg-(--accent)`}>Back to home</Link>
        </section>
      </PageShell>
    );
  }

  return (
    <PageShell className="paper-textured">
      <div className={`${WRAP} text-(--ink)`}>
        <Reveal as="p" className="text-[11px] font-medium uppercase tracking-[0.3em] text-(--ink)/60">Account</Reveal>

        {user === null ? (
          <section className="py-10">
            <RiseText as="h1" lines={["Log in to see", "your account."]} className={`${SERIF} text-[clamp(2.6rem,6vw,5rem)] leading-[0.92]`} />
            <Link href="/login?next=/account" className={`${BTN} mt-8 bg-(--ink) px-8 text-(--cream) hover:bg-(--accent)`}>Log in</Link>
          </section>
        ) : (
          <>
            {/* 프로필 */}
            <section className="flex flex-wrap items-center gap-6 border-b-[3px] border-(--ink) pb-10 pt-6">
              {p.avatar
                ? <img src={p.avatar} alt="" referrerPolicy="no-referrer" className="size-[clamp(72px,9vw,112px)] rounded-full object-cover ring-2 ring-(--ink)" />
                : <span className={`${SERIF} grid size-[clamp(72px,9vw,112px)] place-items-center rounded-full bg-(--ink) text-[40px] text-(--cream)`}>{(p.name || "G").slice(0, 1).toUpperCase()}</span>}
              <div className="min-w-0">
                <h1 className={`${SERIF} truncate text-[clamp(2.4rem,6vw,5rem)] leading-[0.95]`}>{user === undefined ? " " : p.name || "Digger"}</h1>
                <p className="mt-2 truncate text-[15px] text-(--ink)/70">{p.email}</p>
                {user?.created_at && <p className="mt-1 text-[11px] uppercase tracking-[0.22em] text-(--ink)/50">Digging since {formatDate(user.created_at.slice(0, 10))}</p>}
              </div>
            </section>

            {/* 숫자 */}
            <section aria-label="Your records" className="grid grid-cols-3 border-b border-(--ink)/20">
              {[["Owned", counts?.owned, "/collection"], ["Wishlist", counts?.wishlist, "/collection"], ["Requests", counts?.requests, "/digging"]].map(([k, v, href], i) => (
                <Link key={k} href={href} className={`group py-8 ${i ? "border-l border-(--ink)/20 pl-[clamp(1rem,3vw,2rem)]" : ""}`}>
                  <p className={`${SERIF} text-[clamp(2.4rem,6vw,4.6rem)] leading-none tabular-nums`}>{v ?? "–"}</p>
                  <p className="mt-2 text-[11px] font-medium uppercase tracking-[0.24em] text-(--ink)/60 transition-colors group-hover:text-(--accent)">{k} →</p>
                </Link>
              ))}
            </section>

            {/* 로그인 */}
            <section className="grid gap-4 border-b border-(--ink)/20 py-8 sm:grid-cols-[220px_1fr] sm:gap-10">
              <h2 className="text-[11px] font-medium uppercase tracking-[0.24em] text-(--ink)/60">Sign-in</h2>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <p className="text-[15px] leading-7">Signed in with Google<span className="text-(--ink)/60"> · name and photo come from your Google account</span></p>
                <button type="button" onClick={() => signOut()} className={`${BTN} border border-(--ink)/30 hover:border-(--ink)`}>Log out</button>
              </div>
            </section>

            {/* 내 정보 */}
            <section className="grid gap-4 border-b border-(--ink)/20 py-8 sm:grid-cols-[220px_1fr] sm:gap-10">
              <h2 className="text-[11px] font-medium uppercase tracking-[0.24em] text-(--ink)/60">Your data</h2>
              <p className="text-[15px] leading-7 text-(--ink)/80">
                We keep only what you add: your shelves and your requests. Read the <Link href="/privacy" className="underline underline-offset-4">Privacy Policy</Link>, or email <a href={`mailto:${SITE.email}`} className="underline underline-offset-4">{SITE.email}</a> for a copy of your data.
              </p>
            </section>

            {/* 계정 삭제 */}
            <section className="grid gap-4 py-8 sm:grid-cols-[220px_1fr] sm:gap-10">
              <h2 className="text-[11px] font-medium uppercase tracking-[0.24em] text-(--danger)">Delete account</h2>
              <div className="rounded-2xl border border-(--danger)/40 p-[clamp(1.25rem,3vw,1.75rem)]">
                <p className="text-[15px] leading-7">Permanently delete your account and everything in it:</p>
                <ul className="mt-2 grid list-disc gap-1 pl-5 text-[14px] leading-6 text-(--ink)/75 marker:text-(--danger)">
                  <li>your profile and sign-in</li>
                  <li>your Owned and Wishlist shelves</li>
                  <li>your record requests and any covers you uploaded</li>
                </ul>
                {admin ? (
                  <p className="mt-5 text-[14px] leading-6 text-(--ink)/70">This is a staff account. Remove the admin role before deleting it.</p>
                ) : (
                  <button type="button" disabled={!user} onClick={() => dialog.current?.showModal()}
                    className={`${BTN} mt-5 border border-(--danger) text-(--danger) hover:bg-(--danger) hover:text-(--cream) disabled:opacity-40`}>
                    Delete my account
                  </button>
                )}
              </div>
            </section>
            <DeleteDialog dialogRef={dialog} counts={counts} onDeleted={() => setDeleted(true)} />
          </>
        )}
      </div>
    </PageShell>
  );
}
