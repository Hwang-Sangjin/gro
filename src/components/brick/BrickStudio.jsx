"use client";
// /lab/brick — 앨범 커버나 내 사진을 32×32 브릭 판으로. 왼쪽 고르기·보정 / 가운데 3D 판 / 오른쪽 필요한 브릭
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { createClient } from "@/utils/supabase/client";
import { coverUrl } from "@/lib/albums";
import useBrickReveal from "./useBrickReveal";
import { PALETTE } from "@/lib/brick/palette";
import { sampleImage, buildMosaic } from "@/lib/brick/mosaic";
import CropDialog from "./CropDialog";

const BrickBoard = dynamic(() => import("./BrickBoard"), { ssr: false, loading: () => <div className="size-full animate-pulse rounded-[6px] bg-(--ink)/8" /> });

const N = 32;
const SPARE = 0.05;   // 예비 브릭 5%
const SERIF = "font-['Grooves_Display','Hahmlet',Georgia,serif] font-black tracking-[-0.01em]";
const LABEL = "text-[11px] font-medium uppercase tracking-[0.26em] text-(--ink)/60";
// 스크롤 목록 아래쪽을 살짝 페이드 — 더 있다는 표시
const FADE = "[mask-image:linear-gradient(to_bottom,#000_calc(100%-28px),transparent)]";

function loadImage(src) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.crossOrigin = "anonymous";   // 픽셀 색을 읽어야 해서
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = src;
  });
}

// DB 앨범 (최근 등록순, 검색어가 있으면 제목·아티스트에서) — 스크롤하면 30개씩 더 불러와요
const PAGE = 30;
function useAlbums(q) {
  const [rows, setRows] = useState(null);
  const [more, setMore] = useState(false);
  const busy = useRef(false);
  const fetchPage = (from, k) => {
    let req = createClient().from("albums").select("slug, title, artist_names, thumb_path, cover_color")
      .eq("status", "published").not("thumb_path", "is", null).order("created_at", { ascending: false }).range(from, from + PAGE - 1);
    if (k) req = req.or(`title.ilike.%${k}%,artist_names.ilike.%${k}%`);
    return req;
  };
  const key = (v) => v.trim().replace(/[,%()*]/g, " ").trim();
  useEffect(() => {
    let off = false;
    busy.current = false;
    const t = setTimeout(() => {
      fetchPage(0, key(q)).then(({ data }) => { if (!off) { setRows(data ?? []); setMore((data?.length ?? 0) === PAGE); } }, () => { if (!off) { setRows([]); setMore(false); } });
    }, q ? 250 : 0);
    return () => { off = true; clearTimeout(t); };
  }, [q]); // eslint-disable-line react-hooks/exhaustive-deps
  const loadMore = () => {
    if (busy.current || !more || !rows) return;
    busy.current = true;
    fetchPage(rows.length, key(q)).then(({ data }) => {
      const next = data ?? [];
      setRows((r) => [...(r ?? []), ...next.filter((n) => !(r ?? []).some((x) => x.slug === n.slug))]);
      setMore(next.length === PAGE);
    }, () => setMore(false)).finally(() => { busy.current = false; });
  };
  return { rows, more, loadMore };
}

// 나타나기/사라지기: shown 이 true 가 되면 아래에서 올라오며 열리고(i 순서대로 차례로), false 가 되면 빠르게 닫힘
const ShownCtx = createContext(true);
function Reveal({ as: Tag = "div", i = 0, className = "", style, ...rest }) {
  const on = useContext(ShownCtx);
  return (
    <Tag {...rest} data-on={on} style={{ ...style, transitionDelay: on ? `${140 + i * 85}ms` : `${i * 22}ms` }}
      className={`translate-y-6 opacity-0 [clip-path:inset(100%_0_0_0)] transition-[opacity,transform,clip-path] duration-300 ease-[cubic-bezier(.22,1,.36,1)] data-[on=true]:translate-y-0 data-[on=true]:opacity-100 data-[on=true]:[clip-path:inset(-10px)] data-[on=true]:duration-[850ms] motion-reduce:transition-none ${className}`} />
  );
}

// 뉴스 글의 "01 — Title" 머리: 굵은 줄(왼쪽에서 그어짐) + 청록 번호 + 세리프 제목
function Heading({ n, title, note, action }) {
  const on = useContext(ShownCtx);
  return (
    <div className="mb-3">
      <span aria-hidden="true" data-on={on}
        className="block h-1 origin-left scale-x-0 bg-(--ink) transition-transform duration-300 ease-[cubic-bezier(.22,1,.36,1)] data-[on=true]:scale-x-100 data-[on=true]:duration-[900ms] motion-reduce:transition-none" />
      <Reveal i={0} className="flex items-baseline justify-between gap-3 pt-2.5">
        <p className="flex items-baseline gap-2.5">
          <span className="text-[11px] font-medium uppercase tracking-[0.26em] text-(--accent)">{n} —</span>
          <span className={`${SERIF} text-[1.15rem] leading-none`}>{title}</span>
        </p>
        {action ?? (note && <span className="text-[11px] tracking-[0.04em] text-(--ink)/50">{note}</span>)}
      </Reveal>
    </div>
  );
}

function Slider({ label, value, onChange, i = 0 }) {
  return (
    <Reveal as="label" i={i} className="grid grid-cols-[56px_1fr_34px] items-center gap-3 border-b border-dashed border-(--ink)/25 py-3 text-[13px]">
      <span className="text-(--ink)/70">{label}</span>
      <input type="range" min="-0.5" max="0.5" step="0.05" value={value} onChange={(e) => onChange(Number(e.target.value))} className="h-1 w-full cursor-pointer accent-(--accent)" />
      <span className="text-right text-[11px] tabular-nums text-(--ink)/55">{value > 0 ? "+" : ""}{Math.round(value * 100)}</span>
    </Reveal>
  );
}

// 플레이트 모양 색 견본 (네모 + 가운데 원)
function Swatch({ hex, className = "size-6" }) {
  return (
    <span aria-hidden="true" className={`grid shrink-0 place-items-center rounded-[3px] shadow-[inset_0_-2px_0_rgba(0,0,0,.25),0_1px_2px_rgba(0,0,0,.25)] ${className}`} style={{ background: hex }}>
      <span className="size-[56%] rounded-full shadow-[inset_0_1px_0_rgba(255,255,255,.45),0_1px_1px_rgba(0,0,0,.3)]" style={{ background: hex }} />
    </span>
  );
}

export default function BrickStudio() {
  const [q, setQ] = useState("");
  const { rows: albums, more: moreAlbums, loadMore } = useAlbums(q);
  const shown = useBrickReveal();
  const [tab, setTab] = useState("albums");
  const [source, setSource] = useState(null);       // { key, title, sub, img, crop }
  const [pixels, setPixels] = useState(null);
  const [error, setError] = useState("");
  const [adj, setAdj] = useState({ brightness: 0, contrast: 0, saturation: 0, dither: false, maxColors: 0 });
  const [hover, setHover] = useState(null);
  const [replay, setReplay] = useState({ color: null, nonce: 0 });
  const [view, setView] = useState("3d");
  const [cropping, setCropping] = useState(null);   // 올린 이미지 (자르기 전)
  const fileRef = useRef(null);
  const loading = useRef("");

  const pickAlbum = useCallback(async (a) => {
    const key = `album:${a.slug}`;
    loading.current = key;
    setError("");
    try {
      const img = await loadImage(coverUrl(a.thumb_path));
      if (loading.current !== key) return;
      setSource({ key, title: a.title, sub: a.artist_names, slug: a.slug, img, crop: null });
    } catch { setError("이미지를 불러오지 못했어요. 다른 앨범을 골라 주세요."); }
  }, []);

  // 처음엔 가장 최근 앨범으로 시작
  useEffect(() => { if (!source && albums?.length && !q) pickAlbum(albums[0]); }, [albums]); // eslint-disable-line react-hooks/exhaustive-deps

  // 이미지가 바뀌면 32×32 로 샘플링
  useEffect(() => {
    if (!source) return;
    try { setPixels(sampleImage(source.img, source.crop, N)); }
    catch { setError("이 이미지는 색을 읽을 수 없어요 (다른 사이트 이미지 제한)."); }
  }, [source]);

  const mosaic = useMemo(() => (pixels ? buildMosaic(pixels, N, adj) : null), [pixels, adj]);
  const total = N * N;

  const onFile = async (file) => {
    if (!file || !file.type.startsWith("image/")) return;
    const url = URL.createObjectURL(file);
    try { const img = await loadImage(url); setCropping({ img, name: file.name.replace(/\.[^.]+$/, "") }); }
    catch { setError("이미지를 열 수 없어요."); }
  };
  const set = (k) => (v) => setAdj((a) => ({ ...a, [k]: v }));

  return (
    <ShownCtx.Provider value={shown}>
    <div className="mx-auto w-full max-w-[1600px] px-[clamp(16px,3.2vw,44px)] pb-16 pt-[calc(var(--ct-header-h,106px)+14px)] text-(--ink)">
      {/* 제목 줄 */}
      <header className="flex flex-wrap items-end justify-between gap-x-8 gap-y-2 border-b-[3px] border-(--ink) pb-3">
        <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
          <h1 className={`${SERIF} text-[clamp(2.2rem,4.2vw,3.8rem)] leading-[0.95]`}>Brick it.</h1>
          <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-(--accent)">Lab · Brick</p>
        </div>
        <p className="max-w-[46ch] break-keep text-[13px] leading-6 text-(--ink)/70 max-md:hidden">앨범 커버나 내 사진을 브릭 판으로 만들고, 어떤 색이 몇 개 필요한지 바로 확인해요.</p>
        <p className="text-right text-[11px] uppercase tracking-[0.2em] text-(--ink)/65 tabular-nums">
          <span className={`${SERIF} mr-3 text-[clamp(1.4rem,2.2vw,2rem)] normal-case tracking-normal text-(--ink)`}>32 × 32</span>
          {total.toLocaleString()} bricks{mosaic ? ` · ${mosaic.counts.length} colors` : ""}
        </p>
      </header>

      <div className="mt-5 grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[300px_minmax(0,1fr)_300px] lg:items-start">
        {/* 가운데: 3D 판 */}
        <section aria-label="Brick board" className="lg:order-2">
          <div data-on={shown} className="relative mx-auto aspect-square w-full max-w-[min(100%,calc(100svh-290px))] min-w-[280px] opacity-0 transition-opacity duration-300 data-[on=true]:opacity-100">
            <BrickBoard className="absolute inset-0" show={shown} mosaic={mosaic} sourceKey={source?.key} hover={hover} replay={replay} view={view} n={N} />
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
            <div role="radiogroup" aria-label="View" className="inline-flex rounded-full border border-(--ink)/40 p-1">
              {[["3d", "3D"], ["flat", "Flat"]].map(([v, l]) => (
                <button key={v} type="button" role="radio" aria-checked={view === v} onClick={() => setView(v)}
                  className="min-h-9 rounded-full px-4 text-[12px] font-medium uppercase tracking-[0.18em] aria-checked:bg-(--ink) aria-checked:text-(--cream)">{l}</button>
              ))}
            </div>
            <button type="button" onClick={() => setReplay((r) => ({ color: null, nonce: r.nonce + 1 }))}
              className="min-h-11 rounded-full border border-(--ink)/40 px-5 text-[12px] font-medium uppercase tracking-[0.18em] transition-colors hover:border-(--ink)">↻ 다시 끼우기</button>
          </div>
          {source && <p className="mt-3 text-center text-[13px] text-(--ink)/65"><span className="font-medium text-(--ink)">{source.title}</span>{source.sub ? ` — ${source.sub}` : ""}</p>}
          {error && <p role="alert" className="mt-2 text-center text-[13px] text-(--accent)">{error}</p>}
        </section>

        {/* 오른쪽: 필요한 브릭 — 뉴스 글처럼 번호 + 굵은 줄 + 점선 줄 */}
        <section aria-label="Bricks needed" className="lg:order-3">
          <Heading n="03" title="Bricks" note="1×1 플레이트" />
          <Reveal as="ul" i={1} data-lenis-prevent data-crate-ignore className={`${FADE} max-h-[min(54svh,540px)] overflow-y-auto overscroll-contain pb-5 max-lg:flex max-lg:max-h-none max-lg:gap-5 max-lg:overflow-x-auto max-lg:pb-3 max-lg:[mask-image:none]`} onPointerLeave={() => setHover(null)}>
            {mosaic?.counts.map(({ index, count }) => {
              const p = PALETTE[index];
              return (
                <li key={index} className="border-b border-dashed border-(--ink)/25 max-lg:shrink-0 max-lg:border-b-0">
                  <button type="button" onPointerEnter={() => setHover(index)} onFocus={() => setHover(index)} onBlur={() => setHover(null)}
                    onClick={() => setReplay((r) => ({ color: index, nonce: r.nonce + 1 }))} aria-pressed={hover === index}
                    className="group grid w-full grid-cols-[22px_1fr_auto] items-center gap-3.5 border-l-[3px] border-transparent py-2.5 pl-2.5 text-left transition-colors hover:border-(--accent) aria-pressed:border-(--accent) max-lg:w-auto max-lg:grid-cols-[22px_auto_auto]">
                    <Swatch hex={p.hex} className="size-[22px]" />
                    <span className="truncate text-[14px] leading-none">{p.name}</span>
                    <span className="flex items-baseline gap-2 tabular-nums">
                      <span className={`${SERIF} text-[22px] leading-none`}>{count}</span>
                      <span className="w-8 text-[11px] text-(--ink)/45">+{Math.ceil(count * SPARE)}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </Reveal>
          <Reveal i={3} className="mt-2 border-t-[3px] border-(--ink) pt-3">
            <div className="flex items-end justify-between gap-4">
              <p className={LABEL}>Total <span className="normal-case tracking-normal text-(--ink)/45">· {total.toLocaleString()} + 예비 5%</span></p>
              <p className={`${SERIF} text-[2.4rem] leading-none tabular-nums`}>{mosaic ? mosaic.counts.reduce((s, c) => s + count5(c.count), 0).toLocaleString() : "—"}</p>
            </div>
            <p className="mt-3 break-keep text-[12px] leading-5 text-(--ink)/55">색 이름에 마우스를 올리면 판에서 그 색이 떠올라요. 누르면 그 색만 다시 끼워요.</p>
          </Reveal>
        </section>

        {/* 왼쪽: 고르기 + 보정 */}
        <section aria-label="Source" className="grid gap-8 lg:order-1">
          <div>
            <Heading n="01" title="Source" />
            {/* 장르 바처럼: 세리프 이름 + 슬래시, 고른 것만 진하게 + 청록 밑줄 */}
            <Reveal i={1} role="tablist" className="flex items-baseline">
              {[["albums", "Albums"], ["upload", "Upload"]].map(([v, l], i) => (
                <span key={v} className="flex items-baseline">
                  <button type="button" role="tab" aria-selected={tab === v} onClick={() => setTab(v)}
                    className={`${SERIF} min-h-9 border-b-[3px] border-transparent text-[1.7rem] leading-none text-(--ink)/35 transition-colors hover:text-(--ink)/70 aria-selected:border-(--accent) aria-selected:text-(--ink)`}>{l}</button>
                  {i === 0 && <span aria-hidden="true" className="mx-3 text-[1.4rem] text-(--ink)/20">/</span>}
                </span>
              ))}
            </Reveal>
            {tab === "albums" ? (
              <>
                <Reveal as="label" i={2} className="mt-4 flex items-center gap-2.5 border-b border-(--ink)/35 pb-2 focus-within:border-(--ink)">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true" className="size-[18px] shrink-0 text-(--ink)/55"><circle cx="10" cy="10" r="7" /><path d="m15 15 7 7" /></svg>
                  <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search albums, artists" aria-label="앨범·아티스트 검색"
                    className="w-full bg-transparent text-[14px] outline-none placeholder:text-(--ink)/40" />
                </Reveal>
                <Reveal as="ul" i={3} data-lenis-prevent data-crate-ignore onScroll={(e) => { const el = e.currentTarget; if (el.scrollTop + el.clientHeight > el.scrollHeight - 160) loadMore(); }}
                  className={`${FADE} mt-4 grid max-h-[min(44svh,460px)] grid-cols-3 content-start gap-2 overflow-y-auto overscroll-contain px-1 pb-6 pt-1`}>
                  {albums === null && Array.from({ length: 9 }, (_, i) => <li key={i} className="aspect-square animate-pulse bg-(--ink)/8" />)}
                  {albums?.length === 0 && <li className="col-span-3 py-6 text-center text-[13px] text-(--ink)/55">찾는 앨범이 없어요.</li>}
                  {albums?.map((a) => {
                    const on = source?.key === `album:${a.slug}`;
                    return (
                      <li key={a.slug}>
                        <button type="button" onClick={() => pickAlbum(a)} title={`${a.title} — ${a.artist_names}`} aria-pressed={on}
                          className="block aspect-square w-full overflow-hidden shadow-[0_8px_14px_-10px_rgba(0,0,0,.55)] outline-offset-[3px] transition-transform duration-200 hover:-translate-y-0.5 aria-pressed:outline aria-pressed:outline-[3px] aria-pressed:outline-(--accent)"
                          style={{ background: a.cover_color || undefined }}>
                          <img src={coverUrl(a.thumb_path)} alt={a.title} loading="lazy" decoding="async" draggable={false} className="size-full select-none object-cover" />
                        </button>
                      </li>
                    );
                  })}
                  {moreAlbums && albums && <li className="col-span-3 py-2 text-center">
                    <button type="button" onClick={loadMore} className="min-h-9 px-4 text-[11px] font-medium uppercase tracking-[0.22em] text-(--ink)/55 hover:text-(--ink)">More ↓</button></li>}
                </Reveal>
              </>
            ) : (
              <Reveal i={2}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); onFile(e.dataTransfer.files?.[0]); }}
                className="mt-4 grid place-items-center gap-3 border-2 border-dashed border-(--ink)/30 px-4 py-12 text-center">
                <p className="text-[14px] text-(--ink)/75">사진을 끌어다 놓거나</p>
                <button type="button" onClick={() => fileRef.current?.click()} className="min-h-11 rounded-full bg-(--ink) px-6 text-[12px] font-medium uppercase tracking-[0.18em] text-(--cream) transition-colors hover:bg-(--accent)">Choose image</button>
                <p className="break-keep text-[11px] leading-5 text-(--ink)/50">사진은 이 브라우저 안에서만 쓰이고 서버에 올라가지 않아요.</p>
                <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ""; }} />
              </Reveal>
            )}
          </div>

          <div>
            <Heading n="02" title="Adjust" action={<button type="button" onClick={() => setAdj({ brightness: 0, contrast: 0, saturation: 0, dither: false, maxColors: 0 })} className="text-[11px] font-medium uppercase tracking-[0.22em] text-(--ink)/55 hover:text-(--accent)">Reset</button>} />
            <div className="grid">
              <Slider i={1} label="밝기" value={adj.brightness} onChange={set("brightness")} />
              <Slider i={2} label="대비" value={adj.contrast} onChange={set("contrast")} />
              <Slider i={3} label="채도" value={adj.saturation} onChange={set("saturation")} />
              <Reveal as="label" i={4} className="grid grid-cols-[56px_1fr] items-center gap-3 border-b border-dashed border-(--ink)/25 py-3 text-[13px]">
                <span className="text-(--ink)/70">색 수</span>
                <select value={adj.maxColors} onChange={(e) => set("maxColors")(Number(e.target.value))} className="h-8 border-b border-(--ink)/35 bg-transparent text-[13px] outline-none focus:border-(--ink)">
                  <option value={0}>제한 없음 ({PALETTE.length}색 중)</option>
                  {[6, 8, 12, 16, 20].map((v) => <option key={v} value={v}>최대 {v}색</option>)}
                </select>
              </Reveal>
              <Reveal as="label" i={5} className="flex items-center justify-between gap-3 py-3 text-[13px]">
                <span className="text-(--ink)/70">디더링 <span className="ml-1 text-[11px] text-(--ink)/45">점을 섞어 중간색 표현</span></span>
                <input type="checkbox" checked={adj.dither} onChange={(e) => set("dither")(e.target.checked)} className="size-4 accent-(--accent)" />
              </Reveal>
            </div>
          </div>
        </section>
      </div>

      {cropping && (
        <CropDialog img={cropping.img} onCancel={() => setCropping(null)}
          onDone={(crop) => { setSource({ key: `upload:${Date.now()}`, title: cropping.name || "My image", sub: "", img: cropping.img, crop }); setCropping(null); }} />
      )}
    </div>
    </ShownCtx.Provider>
  );
}

const count5 = (c) => c + Math.ceil(c * SPARE);
