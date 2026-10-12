"use client";
// "+ Request" 창: Digging 에 없는 판을 올려 달라고 요청
// - 로그인 안 했으면 로그인 안내 (돌아올 곳 = 지금 페이지)
// - 요청 폼(앨범·아티스트 필수, 링크·메모 선택) → 보내면 "Request sent"
// - 아래에 내 요청 목록과 상태 (대기 / 등록됨 → 앨범으로 / 반려 + 이유)
// 열기: ref.current.open({ title }) — 검색 결과가 없을 때 검색어를 앨범명으로 채워서 열 수 있음
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import Link from "next/link";
import useAuthUser from "@/lib/useAuthUser";
import { submitRequest, fetchMyRequests, STATUS_LABEL } from "@/lib/requests";

const SERIF = "font-['Grooves_Bodoni',Georgia,serif] font-black tracking-[-0.03em]";
const field = "w-full rounded-xl border border-(--ink)/20 bg-transparent px-3.5 py-2.5 text-[14px] outline-none transition-colors placeholder:text-(--ink)/35 focus:border-(--ink)";
const labelCls = "mb-1.5 block text-[10px] font-medium uppercase tracking-[0.22em] text-(--ink)/55";
const EMPTY = { title: "", artist: "", link: "", note: "" };
const DOT = { pending: "bg-[#d9b44a]", added: "bg-[#4f9d69]", declined: "bg-(--ink)/30" };

const RequestDialog = forwardRef(function RequestDialog(_, ref) {
  const dialog = useRef(null);
  const first = useRef(null);
  const user = useAuthUser();
  const [form, setForm] = useState(EMPTY);
  const [state, setState] = useState("form");   // form | sending | sent
  const [error, setError] = useState("");
  const [mine, setMine] = useState(null);

  const loadMine = useCallback(() => {
    fetchMyRequests().then(setMine, () => setMine([]));
  }, []);
  useEffect(() => { if (user) loadMine(); else setMine(null); }, [user, loadMine]);

  useImperativeHandle(ref, () => ({
    open({ title = "" } = {}) {
      setState("form"); setError("");
      setForm((f) => ({ ...EMPTY, title: title || (state === "sent" ? "" : f.title), artist: state === "sent" ? "" : f.artist }));
      dialog.current?.showModal();
      requestAnimationFrame(() => first.current?.focus());
      if (user) loadMine();
    },
  }), [user, state, loadMine]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  async function send(e) {
    e.preventDefault();
    setState("sending"); setError("");
    try { await submitRequest(form); setState("sent"); setForm(EMPTY); loadMine(); }
    catch (err) { setError(err.message); setState("form"); }
  }
  const close = () => dialog.current?.close();
  const here = typeof window === "undefined" ? "/digging" : location.pathname + location.search;

  return (
    <dialog ref={dialog} data-lenis-prevent aria-labelledby="request-title"
      onClick={(e) => { if (e.target === dialog.current) close(); }}
      className="m-auto max-h-[min(88svh,760px)] w-[min(92vw,520px)] overflow-y-auto overscroll-contain rounded-[28px] border border-(--ink)/15 bg-(--cream) p-0 text-(--ink) shadow-[0_40px_80px_-30px_rgba(30,20,28,.55)] backdrop:bg-[#2a222a]/55 backdrop:backdrop-blur-[2px] open:animate-[request-in_.45s_cubic-bezier(.22,1,.36,1)]">
      <div className="relative px-7 pb-7 pt-8 sm:px-9">
        <button type="button" onClick={close} aria-label="Close" className="absolute right-5 top-5 grid size-9 place-items-center rounded-full text-[22px] leading-none text-(--ink)/60 hover:bg-(--ink)/8 hover:text-(--ink)">×</button>
        <p className="text-[10px] font-medium uppercase tracking-[0.3em] text-(--ink)/55">Digging · Request</p>
        <h2 id="request-title" className={`${SERIF} mt-2 text-[40px] leading-[0.95]`}>Request a record</h2>
        <p className="mt-3 text-[13px] leading-6 text-(--ink)/65">Can’t find it in the crate? Tell us the record and we’ll try to add it.</p>

        {user === null ? (
          <div className="mt-7 rounded-2xl border border-(--ink)/12 p-5">
            <p className="text-[14px]">Log in to send a request and follow its status.</p>
            <Link href={`/login?next=${encodeURIComponent(here)}`} onClick={close}
              className="mt-4 inline-flex min-h-11 items-center rounded-full bg-(--ink) px-6 text-[12px] font-medium uppercase tracking-[0.16em] text-(--cream) hover:bg-[#c8553d]">Log in</Link>
          </div>
        ) : state === "sent" ? (
          <div role="status" className="mt-7 rounded-2xl bg-[#4f9d69]/12 p-5">
            <p className={`${SERIF} text-[24px]`}>Request sent</p>
            <p className="mt-1 text-[13px] text-(--ink)/70">We’ll let it spin in the queue. You can check its status below.</p>
            <button type="button" onClick={() => setState("form")} className="mt-4 text-[12px] font-medium uppercase tracking-[0.16em] underline underline-offset-4">Request another</button>
          </div>
        ) : (
          <form onSubmit={send} className="mt-7 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="rq-title" className={labelCls}>Album *</label>
                <input ref={first} id="rq-title" className={field} value={form.title} onChange={set("title")} maxLength={200} required placeholder="Blonde" />
              </div>
              <div>
                <label htmlFor="rq-artist" className={labelCls}>Artist *</label>
                <input id="rq-artist" className={field} value={form.artist} onChange={set("artist")} maxLength={200} required placeholder="Frank Ocean" />
              </div>
            </div>
            <div>
              <label htmlFor="rq-link" className={labelCls}>Link <span className="normal-case tracking-normal opacity-70">(Discogs, Spotify, YouTube…)</span></label>
              <input id="rq-link" type="url" className={field} value={form.link} onChange={set("link")} maxLength={500} placeholder="https://" />
            </div>
            <div>
              <label htmlFor="rq-note" className={labelCls}>Note</label>
              <textarea id="rq-note" className={`${field} min-h-20 resize-y`} value={form.note} onChange={set("note")} maxLength={1000} placeholder="Pressing, edition, why you love it…" />
            </div>
            {error && <p role="alert" className="text-[13px] text-[#c8553d]">{error}</p>}
            <button type="submit" disabled={state === "sending" || user === undefined}
              className="inline-flex min-h-12 w-full items-center justify-center rounded-full bg-(--ink) text-[12px] font-medium uppercase tracking-[0.18em] text-(--cream) transition-colors hover:bg-[#c8553d] disabled:opacity-50">
              {state === "sending" ? "Sending…" : "Send request"}
            </button>
          </form>
        )}

        {user && mine?.length > 0 && (
          <section className="mt-8 border-t border-(--ink)/15 pt-5" aria-label="My requests">
            <h3 className="text-[10px] font-medium uppercase tracking-[0.3em] text-(--ink)/55">Your requests</h3>
            <ul className="mt-3 divide-y divide-(--ink)/10">
              {mine.map((r) => (
                <li key={r.id} className="flex items-start justify-between gap-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-[14px] font-medium">{r.title}</p>
                    <p className="truncate text-[12px] text-(--ink)/55">{r.artist}</p>
                    {r.status === "declined" && r.admin_note && <p className="mt-1 text-[12px] text-(--ink)/60">“{r.admin_note}”</p>}
                  </div>
                  {r.status === "added" && r.album_slug ? (
                    <Link href={`/album/${encodeURIComponent(r.album_slug)}`} onClick={close} className="flex shrink-0 items-center gap-2 rounded-full border border-(--ink)/20 px-3 py-1 text-[11px] uppercase tracking-[0.12em] hover:border-(--ink)">
                      <span className={`size-1.5 rounded-full ${DOT.added}`} />Added · Listen
                    </Link>
                  ) : (
                    <span className="flex shrink-0 items-center gap-2 px-1 py-1 text-[11px] uppercase tracking-[0.12em] text-(--ink)/65">
                      <span className={`size-1.5 rounded-full ${DOT[r.status]}`} />{STATUS_LABEL[r.status]}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </dialog>
  );
});

export default RequestDialog;
