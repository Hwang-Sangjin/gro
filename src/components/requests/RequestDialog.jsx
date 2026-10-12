"use client";
// "+ Request" 창: Digging 에 없는 판을 올려 달라고 요청
// - 로그인 안 했으면 로그인 안내 (돌아올 곳 = 지금 페이지)
// - 요청 폼(앨범·아티스트 필수, 링크·메모 선택) → 보내면 "Request sent"
// - More details(선택): 장르·발매일/연도·포맷·레이블·카탈로그·YouTube·트랙·커버 → 관리자 등록 폼에 그대로 채워짐
// - 아래에 내 요청 목록과 상태 (대기 / 등록됨 → 앨범으로 / 반려 + 이유)
// 열기: ref.current.open({ title, artist, releaseYear }) — 검색 결과가 없을 때 검색어를 앨범명으로 채워서 열 수 있음
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import Link from "next/link";
import useAuthUser from "@/lib/useAuthUser";
import { submitRequest, fetchMyRequests, STATUS_LABEL } from "@/lib/requests";
import { GENRES } from "@/lib/genres";
import { parseTracks, TRACK_PLACEHOLDER, FORMATS } from "@/lib/tracks";

const SERIF = "font-['Grooves_Bodoni',Georgia,serif] font-black tracking-[-0.03em]";
const field = "w-full rounded-xl border border-(--ink)/20 bg-transparent px-3.5 py-2.5 text-[14px] outline-none transition-colors placeholder:text-(--ink)/35 focus:border-(--ink)";
const labelCls = "mb-1.5 block text-[10px] font-medium uppercase tracking-[0.22em] text-(--ink)/55";
const EMPTY = { title: "", artist: "", link: "", note: "", genres: [], releaseDate: "", releaseYear: "", format: "", label: "", catalogNo: "", youtube: "", tracks: "", cover: null };
const DOT = { pending: "bg-[#d9b44a]", added: "bg-[#4f9d69]", declined: "bg-(--ink)/30" };

const RequestDialog = forwardRef(function RequestDialog(_, ref) {
  const dialog = useRef(null);
  const first = useRef(null);
  const user = useAuthUser();
  const [form, setForm] = useState(EMPTY);
  const [state, setState] = useState("form");   // form | sending | sent
  const [error, setError] = useState("");
  const [mine, setMine] = useState(null);
  const [more, setMore] = useState(false);
  const [preview, setPreview] = useState(null);
  const parsed = useMemo(() => parseTracks(form.tracks), [form.tracks]);
  useEffect(() => {
    if (!form.cover) { setPreview(null); return; }
    const url = URL.createObjectURL(form.cover);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [form.cover]);

  const loadMine = useCallback(() => {
    fetchMyRequests().then(setMine, () => setMine([]));
  }, []);
  useEffect(() => { if (user) loadMine(); else setMine(null); }, [user, loadMine]);

  useImperativeHandle(ref, () => ({
    open({ title = "", artist = "", releaseYear = "" } = {}) {
      setState("form"); setError("");
      setForm((f) => (title
        ? { ...EMPTY, title, artist, releaseYear: String(releaseYear || "") }
        : { ...EMPTY, title: state === "sent" ? "" : f.title, artist: state === "sent" ? "" : f.artist }));
      dialog.current?.showModal();
      requestAnimationFrame(() => first.current?.focus());
      if (user) loadMine();
    },
  }), [user, state, loadMine]);

  const set = (key) => (e) => {
    const value = e.target.value;
    setForm((f) => ({ ...f, [key]: value, ...(key === "releaseDate" && value ? { releaseYear: value.slice(0, 4) } : {}) }));
  };
  const toggleGenre = (slug) => setForm((f) => ({ ...f, genres: f.genres.includes(slug) ? f.genres.filter((g) => g !== slug) : [...f.genres, slug] }));
  function pickCover(e) {
    const file = e.target.files?.[0] ?? null;
    if (file && file.size > 5 * 1024 * 1024) { setError("Cover image must be 5MB or smaller."); e.target.value = ""; return; }
    setError(""); setForm((f) => ({ ...f, cover: file }));
  }
  async function send(e) {
    e.preventDefault();
    if (parsed.errors.length) { setMore(true); setError(`Tracks — ${parsed.errors[0]}`); return; }
    setState("sending"); setError("");
    try { await submitRequest(form); setState("sent"); setForm(EMPTY); setMore(false); loadMine(); }
    catch (err) { setError(err.message); setState("form"); }
  }
  // 닫기: 아래로 내려가는 애니메이션이 끝난 뒤 실제로 닫음 (움직임 줄이기면 바로)
  const close = useCallback(() => {
    const el = dialog.current;
    if (!el?.open || el.dataset.closing) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) { el.close(); return; }
    el.dataset.closing = "true";
    const done = (e) => {
      if (e && (e.target !== el || e.animationName !== "sheet-down")) return;   // 여는 애니메이션·뒤 막 이벤트는 무시
      el.removeEventListener("animationend", done);
      clearTimeout(fallback);
      delete el.dataset.closing;
      el.close();
    };
    const fallback = setTimeout(done, 1200);   // 애니메이션 이벤트가 안 오더라도 닫힘 (바쁜 화면에서 애니메이션을 끊지 않게 넉넉히)
    el.addEventListener("animationend", done);
  }, []);
  // Esc 도 같은 애니메이션으로
  useEffect(() => {
    const el = dialog.current;
    const onCancel = (e) => { e.preventDefault(); close(); };
    el?.addEventListener("cancel", onCancel);
    return () => el?.removeEventListener("cancel", onCancel);
  }, [close]);
  const here = typeof window === "undefined" ? "/digging" : location.pathname + location.search;

  return (
    <dialog ref={dialog} data-lenis-prevent aria-labelledby="request-title"
      onClick={(e) => { if (e.target === dialog.current) close(); }}
      className="m-auto max-h-[min(90svh,860px)] w-[min(92vw,600px)] overflow-y-auto overscroll-contain rounded-[28px] border border-(--ink)/15 bg-(--cream) p-0 text-(--ink) shadow-[0_40px_80px_-30px_rgba(30,20,28,.55)] backdrop:bg-[#2a222a]/55 backdrop:backdrop-blur-[2px] open:animate-[sheet-up_.7s_cubic-bezier(.22,1,.36,1)_both] open:backdrop:animate-[veil-in_.45s_ease-out_both] data-[closing=true]:animate-[sheet-down_.5s_cubic-bezier(.55,0,.75,.2)_both] data-[closing=true]:backdrop:animate-[veil-out_.5s_ease-in_both] motion-reduce:animate-none motion-reduce:backdrop:animate-none">
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

            {/* 선택 정보: 펼쳐서 채움 (관리자가 등록할 때 그대로 쓰임) */}
            <div className="rounded-2xl border border-(--ink)/12">
              <button type="button" onClick={() => setMore((v) => !v)} aria-expanded={more} aria-controls="rq-more"
                className="flex w-full items-center justify-between px-4 py-3.5 text-left">
                <span>
                  <span className="block text-[12px] font-medium uppercase tracking-[0.16em]">More details</span>
                  <span className="block text-[12px] text-(--ink)/55">Optional — genres, release, tracks, cover… helps us add it faster.</span>
                </span>
                <span aria-hidden="true" className={`grid size-7 shrink-0 place-items-center rounded-full border border-(--ink)/25 text-[16px] leading-none transition-transform duration-300 ${more ? "rotate-45" : ""}`}>+</span>
              </button>
              <div id="rq-more" hidden={!more} className="space-y-4 border-t border-(--ink)/12 px-4 pb-5 pt-4">
                <div>
                  <span className={labelCls}>Genres</span>
                  <div className="flex flex-wrap gap-1.5">
                    {GENRES.map((g) => (
                      <button type="button" key={g.slug} onClick={() => toggleGenre(g.slug)} aria-pressed={form.genres.includes(g.slug)}
                        className="rounded-full border border-(--ink)/25 px-3 py-1 text-[12px] transition-colors hover:border-(--ink) aria-pressed:border-(--ink) aria-pressed:bg-(--ink) aria-pressed:text-(--cream)">{g.name}</button>
                    ))}
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-[1.4fr_.8fr_1fr]">
                  <div>
                    <label htmlFor="rq-date" className={labelCls}>Release date</label>
                    <input id="rq-date" type="date" className={field} value={form.releaseDate} onChange={set("releaseDate")} />
                  </div>
                  <div>
                    <label htmlFor="rq-year" className={labelCls}>Year</label>
                    <input id="rq-year" inputMode="numeric" pattern="\d{4}" maxLength={4} className={field} value={form.releaseYear} onChange={set("releaseYear")} placeholder="2016" />
                  </div>
                  <div>
                    <label htmlFor="rq-format" className={labelCls}>Format</label>
                    <select id="rq-format" className={field} value={form.format} onChange={set("format")}>
                      <option value="">—</option>
                      {FORMATS.map((f) => <option key={f}>{f}</option>)}
                    </select>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label htmlFor="rq-label" className={labelCls}>Label</label>
                    <input id="rq-label" className={field} value={form.label} onChange={set("label")} maxLength={200} placeholder="Boys Don’t Cry" />
                  </div>
                  <div>
                    <label htmlFor="rq-cat" className={labelCls}>Catalog no.</label>
                    <input id="rq-cat" className={field} value={form.catalogNo} onChange={set("catalogNo")} maxLength={100} placeholder="BDC-001" />
                  </div>
                </div>
                <div>
                  <label htmlFor="rq-yt" className={labelCls}>YouTube playlist</label>
                  <input id="rq-yt" className={field} value={form.youtube} onChange={set("youtube")} maxLength={300} placeholder="Link or ID" />
                </div>
                <div>
                  <label htmlFor="rq-tracks" className={labelCls}>Tracks <span className="normal-case tracking-normal opacity-70">(side | title | time)</span></label>
                  <textarea id="rq-tracks" className={`${field} min-h-28 resize-y font-mono text-[12px]`} value={form.tracks} onChange={set("tracks")} maxLength={6000} placeholder={TRACK_PLACEHOLDER} />
                  {form.tracks.trim() && (parsed.errors.length
                    ? <p className="mt-1.5 text-[12px] text-[#c8553d]">{parsed.errors[0]}</p>
                    : <p className="mt-1.5 text-[12px] text-(--ink)/55">{parsed.rows.length} tracks · A·B → LP1, C·D → LP2</p>)}
                </div>
                <div>
                  <span className={labelCls}>Cover image</span>
                  <div className="flex items-center gap-4">
                    <span className="grid size-20 shrink-0 place-items-center overflow-hidden rounded-lg border border-dashed border-(--ink)/25 text-[10px] uppercase tracking-[0.12em] text-(--ink)/40">
                      {preview ? <img src={preview} alt="" className="size-full object-cover" /> : "None"}
                    </span>
                    <div className="min-w-0 text-[12px] text-(--ink)/55">
                      <input id="rq-cover" type="file" accept="image/jpeg,image/png,image/webp,image/avif" onChange={pickCover} aria-label="Cover image"
                        className="w-full text-[12px] file:mr-3 file:rounded-full file:border file:border-(--ink)/30 file:bg-transparent file:px-3 file:py-1.5 file:text-[12px] file:text-(--ink)" />
                      <p className="mt-1.5">Square, 500px+ looks best · max 5MB</p>
                      {form.cover && <button type="button" onClick={() => { setForm((f) => ({ ...f, cover: null })); const el = document.getElementById("rq-cover"); if (el) el.value = ""; }} className="mt-1 underline underline-offset-4">Remove</button>}
                    </div>
                  </div>
                </div>
              </div>
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
