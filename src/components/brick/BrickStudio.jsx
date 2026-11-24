"use client";
// /lab/brick — 앨범 커버나 내 사진을 32×32 브릭 판으로
// 왼쪽: 2D 브릭 판 + 아래에 필요한 브릭(색별 개수) / 오른쪽(고정): 고르기 · 보정(접고 펴기)
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { coverUrl } from "@/lib/albums";
import useLabReveal from "@/components/lab/useLabReveal";
import GrooveText from "@/components/lab/GrooveText";
import { SERIF, LABEL, ShownCtx, Reveal, Heading } from "@/components/lab/LabUI";
import { PALETTE } from "@/lib/brick/palette";
import { sampleImage, buildMosaic } from "@/lib/brick/mosaic";
import BrickCanvas from "./BrickCanvas";
import CropDialog from "./CropDialog";

const N = 32;
const SPARE = 0.05;   // 예비 브릭 5% (색마다 올림)
const withSpare = (c) => c + Math.ceil(c * SPARE);
const NO_ADJ = { brightness: 0, contrast: 0, saturation: 0, dither: false, maxColors: 0 };
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

function Slider({ label, value, onChange, i = 0 }) {
  return (
    <Reveal as="label" i={i} className="grid grid-cols-[56px_1fr_34px] items-center gap-3 border-b border-dashed border-(--ink)/25 py-2.5 text-[13px]">
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
  const shown = useLabReveal();
  const [tab, setTab] = useState("albums");
  const [source, setSource] = useState(null);       // { key, title, sub, img, crop }
  const [pixels, setPixels] = useState(null);
  const [error, setError] = useState("");
  const [adj, setAdj] = useState(NO_ADJ);
  const [adjOpen, setAdjOpen] = useState(false);
  const [hover, setHover] = useState(null);
  const [tone, setTone] = useState("brick");     // brick: 팔레트 색 / true: 보정한 원래 색
  const [replay, setReplay] = useState({ color: null, nonce: 0 });
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
  // 판에 그릴 색 — 개수(counts)는 늘 브릭 색 기준
  const board = useMemo(() => (mosaic ? { ...mosaic, colors: tone === "true" ? mosaic.trueColors : mosaic.colors } : null), [mosaic, tone]);
  const total = N * N;
  const countOf = (index) => mosaic?.counts.find((c) => c.index === index)?.count ?? 0;

  const onFile = async (file) => {
    if (!file || !file.type.startsWith("image/")) return;
    const url = URL.createObjectURL(file);
    try { const img = await loadImage(url); setCropping({ img, url, name: file.name.replace(/\.[^.]+$/, "") }); }
    catch { URL.revokeObjectURL(url); setError("이미지를 열 수 없어요."); }
  };
  // 자르기 창을 닫으면 임시 주소는 버려요 (이미지는 이미 읽혀 있어서 판에는 영향 없음)
  const closeCrop = () => { if (cropping?.url) URL.revokeObjectURL(cropping.url); setCropping(null); };
  const set = (k) => (v) => setAdj((a) => ({ ...a, [k]: v }));
  const hp = hover != null ? PALETTE[hover] : null;

  return (
    <ShownCtx.Provider value={shown}>
    <div className="mx-auto w-full max-w-[1600px] px-[clamp(16px,3.2vw,44px)] pb-16 pt-[calc(var(--ct-header-h,106px)+14px)] text-(--ink)">
      {/* 제목 줄 */}
      <header className="flex flex-wrap items-end justify-between gap-x-8 gap-y-2 border-b-[3px] border-(--ink) pb-3">
        <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
          <GrooveText as="h1" className="text-[clamp(2.1rem,4vw,3.6rem)] leading-[1.05]">Brick it.</GrooveText>
          <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-(--accent)">Lab · Brick</p>
        </div>
        <p className="max-w-[46ch] break-keep text-[13px] leading-6 text-(--ink)/70 max-md:hidden">앨범 커버나 내 사진을 브릭 판으로 만들고, 어떤 색이 몇 개 필요한지 바로 확인해요.</p>
        <p className="text-right text-[11px] uppercase tracking-[0.2em] text-(--ink)/65 tabular-nums">
          <span className={`${SERIF} mr-3 text-[clamp(1.4rem,2.2vw,2rem)] normal-case tracking-normal text-(--ink)`}>32 × 32</span>
          {total.toLocaleString()} bricks{mosaic ? ` · ${mosaic.counts.length} colors` : ""}
        </p>
      </header>

      <div className="mt-6 grid grid-cols-[minmax(0,1fr)] gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(300px,360px)] lg:items-start xl:gap-14">
        {/* 왼쪽: 브릭 판 + 필요한 브릭 */}
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-10">
          <section aria-label="Brick board" className="min-w-0">
            <div data-on={shown} className="mx-auto w-full max-w-[min(100%,calc(100svh-var(--ct-header-h,106px)-190px))] min-w-[260px] opacity-0 transition-opacity duration-300 data-[on=true]:opacity-100">
              <BrickCanvas className="aspect-square w-full" show={shown} mosaic={board} sourceKey={source?.key} hover={hover} replay={replay} n={N} />
              <div className="mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
                {/* 색 목록에서 가리킨 색 / 아니면 지금 이미지 */}
                <p aria-live="polite" className="min-w-48 flex-1 basis-0 truncate text-[13px] text-(--ink)/65">
                  {hp ? (
                    <span className="inline-flex items-center gap-2.5"><Swatch hex={hp.hex} className="size-[18px]" /><span className="font-medium text-(--ink)">{hp.name}</span><span className="tabular-nums">{countOf(hover)}개</span></span>
                  ) : source ? (
                    <><span className="font-medium text-(--ink)">{source.title}</span>{source.sub ? ` — ${source.sub}` : ""}</>
                  ) : null}
                </p>
                <div className="flex shrink-0 items-center gap-2">
                  <div role="radiogroup" aria-label="판 색" className="inline-flex rounded-full border border-(--ink)/40 p-1">
                    {[["brick", "브릭 색"], ["true", "원본 색"]].map(([v, l]) => (
                      <button key={v} type="button" role="radio" aria-checked={tone === v} onClick={() => setTone(v)}
                        className="min-h-9 rounded-full px-3.5 text-[12px] font-medium tracking-[0.04em] aria-checked:bg-(--ink) aria-checked:text-(--cream)">{l}</button>
                    ))}
                  </div>
                  <button type="button" onClick={() => setReplay((r) => ({ color: null, nonce: r.nonce + 1 }))}
                    className="min-h-11 rounded-full border border-(--ink)/40 px-5 text-[12px] font-medium uppercase tracking-[0.18em] transition-colors hover:border-(--ink)">↻ 다시 끼우기</button>
                </div>
              </div>
              {error && <p role="alert" className="mt-2 text-[13px] text-(--accent)">{error}</p>}
            </div>
          </section>

          {/* 필요한 브릭 — 판 아래, 여러 줄로 */}
          <section aria-label="Bricks needed">
            <Heading n="03" title="Bricks" note={tone === "true" ? "원본 색으로 보는 중 · 개수는 브릭 색 기준" : "1×1 플레이트 · 색마다 예비 5%"} />
            <Reveal as="ul" i={1} className="grid grid-cols-[repeat(auto-fill,minmax(228px,1fr))] gap-x-8" onPointerLeave={() => setHover(null)}>
              {mosaic?.counts.map(({ index, count }) => {
                const p = PALETTE[index];
                return (
                  <li key={index} className="border-b border-dashed border-(--ink)/25">
                    <button type="button" onPointerEnter={() => setHover(index)} onFocus={() => setHover(index)} onBlur={() => setHover(null)}
                      onClick={() => setReplay((r) => ({ color: index, nonce: r.nonce + 1 }))} aria-pressed={hover === index}
                      className="grid w-full grid-cols-[22px_1fr_auto] items-center gap-3 border-l-[3px] border-transparent py-2.5 pl-2.5 text-left transition-colors hover:border-(--accent) aria-pressed:border-(--accent)">
                      <Swatch hex={p.hex} className="size-[22px]" />
                      <span className="truncate text-[14px] leading-none">{p.name}</span>
                      <span className="flex items-baseline gap-2 tabular-nums">
                        <span className={`${SERIF} text-[22px] leading-none`}>{count}</span>
                        <span className="w-7 text-[11px] text-(--ink)/45">+{Math.ceil(count * SPARE)}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </Reveal>
            <Reveal i={3} className="mt-4 flex flex-wrap items-end justify-between gap-x-8 gap-y-3 border-t-[3px] border-(--ink) pt-3">
              <p className="max-w-[52ch] break-keep text-[12px] leading-5 text-(--ink)/55">색 이름을 가리키면 판에서 그 색 브릭이 떠올라요. 색 이름을 누르면 그 색만 다시 끼워요.</p>
              <div className="flex items-end gap-4">
                <p className={LABEL}>Total <span className="normal-case tracking-normal text-(--ink)/45">· {total.toLocaleString()} + 예비</span></p>
                <p className={`${SERIF} text-[2.4rem] leading-none tabular-nums`}>{mosaic ? mosaic.counts.reduce((s, c) => s + withSpare(c.count), 0).toLocaleString() : "—"}</p>
              </div>
            </Reveal>
          </section>
        </div>

        {/* 오른쪽: 고르기 + 보정 — 넓은 화면에선 화면 높이에 맞춰 고정 */}
        <aside aria-label="Source and adjust" className="grid gap-8 lg:sticky lg:top-[calc(var(--ct-header-h,106px)+14px)] lg:flex lg:max-h-[calc(100svh-var(--ct-header-h,106px)-32px)] lg:flex-col lg:gap-6">
          <section aria-label="Source" className="flex min-h-0 flex-col lg:flex-1">
            <Heading n="01" title="Source" />
            {/* 장르 바처럼: 세리프 이름 + 슬래시, 고른 것만 진하게 + 청록 밑줄 */}
            <Reveal i={1} role="tablist" className="flex items-baseline">
              {[["albums", "Albums"], ["upload", "Upload"]].map(([v, l], i) => (
                <span key={v} className="flex items-baseline">
                  <button type="button" role="tab" aria-selected={tab === v} onClick={() => setTab(v)}
                    className={`${SERIF} min-h-9 border-b-[3px] border-transparent text-[1.7rem] leading-none text-(--ink)/60 transition-colors hover:text-(--ink)/85 aria-selected:border-(--accent) aria-selected:text-(--ink)`}>{l}</button>
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
                  className={`${FADE} mt-4 grid max-h-[min(44svh,460px)] grid-cols-3 content-start gap-2 overflow-y-auto overscroll-contain px-1 pb-6 pt-1 lg:max-h-none lg:min-h-[180px] lg:flex-1`}>
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
          </section>

          {/* 보정 — 접어 두면 앨범 목록이 넓어짐 */}
          <section aria-label="Adjust" className="shrink-0">
            <Heading n="02" title="Adjust" action={
              <span className="flex items-baseline gap-4">
                {adjOpen && <button type="button" onClick={() => setAdj(NO_ADJ)} className="text-[11px] font-medium uppercase tracking-[0.22em] text-(--ink)/55 hover:text-(--accent)">Reset</button>}
                <button type="button" aria-expanded={adjOpen} aria-controls="brick-adjust" onClick={() => setAdjOpen((o) => !o)}
                  className="min-h-8 text-[11px] font-medium uppercase tracking-[0.22em] text-(--ink)/70 hover:text-(--accent)">{adjOpen ? "접기 −" : "열기 +"}</button>
              </span>
            } />
            {adjOpen && (
              <div id="brick-adjust" className="grid">
                <Slider i={1} label="밝기" value={adj.brightness} onChange={set("brightness")} />
                <Slider i={2} label="대비" value={adj.contrast} onChange={set("contrast")} />
                <Slider i={3} label="채도" value={adj.saturation} onChange={set("saturation")} />
                <Reveal as="label" i={4} className="grid grid-cols-[56px_1fr] items-center gap-3 border-b border-dashed border-(--ink)/25 py-2.5 text-[13px]">
                  <span className="text-(--ink)/70">색 수</span>
                  <select value={adj.maxColors} onChange={(e) => set("maxColors")(Number(e.target.value))} className="h-8 border-b border-(--ink)/35 bg-transparent text-[13px] outline-none focus:border-(--ink)">
                    <option value={0}>제한 없음 ({PALETTE.length}색 중)</option>
                    {[6, 8, 12, 16, 20].map((v) => <option key={v} value={v}>최대 {v}색</option>)}
                  </select>
                </Reveal>
                <Reveal as="label" i={5} className="flex items-center justify-between gap-3 py-2.5 text-[13px]">
                  <span className="text-(--ink)/70">디더링 <span className="ml-1 text-[11px] text-(--ink)/45">점을 섞어 중간색 표현</span></span>
                  <input type="checkbox" checked={adj.dither} onChange={(e) => set("dither")(e.target.checked)} className="size-4 accent-(--accent)" />
                </Reveal>
              </div>
            )}
          </section>
        </aside>
      </div>

      {cropping && (
        <CropDialog img={cropping.img} onCancel={closeCrop}
          onDone={(crop) => { setSource({ key: `upload:${Date.now()}`, title: cropping.name || "My image", sub: "", img: cropping.img, crop }); closeCrop(); }} />
      )}
    </div>
    </ShownCtx.Provider>
  );
}
