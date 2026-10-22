"use client";
// /lab/brick — 앨범 커버나 내 사진을 32×32 브릭 판으로. 왼쪽 고르기·보정 / 가운데 3D 판 / 오른쪽 필요한 브릭
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { createClient } from "@/utils/supabase/client";
import { coverUrl } from "@/lib/albums";
import { PALETTE } from "@/lib/brick/palette";
import { sampleImage, buildMosaic } from "@/lib/brick/mosaic";
import CropDialog from "./CropDialog";

const BrickBoard = dynamic(() => import("./BrickBoard"), { ssr: false, loading: () => <div className="size-full animate-pulse rounded-[6px] bg-(--ink)/8" /> });

const N = 32;
const SPARE = 0.05;   // 예비 브릭 5%
const SERIF = "font-['Grooves_Display','Hahmlet',Georgia,serif] font-black tracking-[-0.01em]";
const LABEL = "text-[11px] font-medium uppercase tracking-[0.26em] text-(--ink)/60";
const PANEL = "rounded-[6px] border-[2px] border-(--ink)/80 bg-(--cream)/60";

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

function Slider({ label, value, onChange }) {
  return (
    <label className="grid grid-cols-[64px_1fr_36px] items-center gap-3 text-[13px]">
      <span className="text-(--ink)/75">{label}</span>
      <input type="range" min="-0.5" max="0.5" step="0.05" value={value} onChange={(e) => onChange(Number(e.target.value))} className="accent-(--accent)" />
      <span className="text-right text-[11px] tabular-nums text-(--ink)/55">{value > 0 ? "+" : ""}{Math.round(value * 100)}</span>
    </label>
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
          <div className="relative mx-auto aspect-square w-full max-w-[min(100%,calc(100svh-290px))] min-w-[280px]">
            <BrickBoard className="absolute inset-0" mosaic={mosaic} sourceKey={source?.key} hover={hover} replay={replay} view={view} n={N} />
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

        {/* 오른쪽: 필요한 브릭 */}
        <section aria-label="Bricks needed" className={`${PANEL} p-4 lg:order-3`}>
          <div className="flex items-baseline justify-between">
            <p className={LABEL}>Bricks</p>
            <p className="text-[11px] text-(--ink)/55">1×1 플레이트</p>
          </div>
          <ul data-lenis-prevent data-crate-ignore className="mt-3 grid max-h-[min(56svh,560px)] gap-0.5 overflow-y-auto pr-1 max-lg:flex max-lg:max-h-none max-lg:overflow-x-auto max-lg:pb-2" onPointerLeave={() => setHover(null)}>
            {mosaic?.counts.map(({ index, count }) => {
              const p = PALETTE[index];
              return (
                <li key={index} className="max-lg:shrink-0">
                  <button type="button" onPointerEnter={() => setHover(index)} onFocus={() => setHover(index)} onBlur={() => setHover(null)}
                    onClick={() => setReplay((r) => ({ color: index, nonce: r.nonce + 1 }))} aria-pressed={hover === index}
                    className="grid w-full grid-cols-[24px_1fr_auto] items-center gap-3 rounded-[4px] px-2 py-1.5 text-left transition-colors hover:bg-(--ink)/8 aria-pressed:bg-(--ink)/10 max-lg:w-auto max-lg:grid-cols-[24px_auto_auto]">
                    <Swatch hex={p.hex} />
                    <span className="truncate text-[13px]">{p.name}</span>
                    <span className="text-[13px] tabular-nums"><span className="font-medium">{count}</span><span className="ml-1.5 text-[11px] text-(--ink)/45">+{Math.ceil(count * SPARE)}</span></span>
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="mt-3 flex items-baseline justify-between border-t border-dashed border-(--ink)/30 pt-3 text-[13px]">
            <span className="text-(--ink)/70">총 {total.toLocaleString()}개 <span className="text-(--ink)/45">+ 예비 5%</span></span>
            <span className={`${SERIF} text-[22px] tabular-nums`}>{mosaic ? mosaic.counts.reduce((s, c) => s + count5(c.count), 0).toLocaleString() : "—"}</span>
          </div>
          <p className="mt-2 text-[11px] leading-5 text-(--ink)/50">색 이름에 마우스를 올리면 판에서 그 색이 떠올라요. 누르면 그 색만 다시 끼워요.</p>
        </section>

        {/* 왼쪽: 고르기 + 보정 */}
        <section aria-label="Source" className="grid gap-4 lg:order-1">
          <div className={`${PANEL} p-4`}>
            <div role="tablist" className="flex gap-1 rounded-full border border-(--ink)/40 p-1">
              {[["albums", "Albums"], ["upload", "Upload"]].map(([v, l]) => (
                <button key={v} type="button" role="tab" aria-selected={tab === v} onClick={() => setTab(v)}
                  className="min-h-9 flex-1 rounded-full text-[12px] font-medium uppercase tracking-[0.18em] aria-selected:bg-(--ink) aria-selected:text-(--cream)">{l}</button>
              ))}
            </div>
            {tab === "albums" ? (
              <>
                <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="앨범·아티스트 검색"
                  className="mt-3 h-10 w-full rounded-full border border-(--ink)/30 bg-transparent px-4 text-[14px] outline-none placeholder:text-(--ink)/40 focus:border-(--ink)" />
                <ul data-lenis-prevent data-crate-ignore onScroll={(e) => { const el = e.currentTarget; if (el.scrollTop + el.clientHeight > el.scrollHeight - 160) loadMore(); }}
                  className="mt-3 grid max-h-[min(46svh,480px)] grid-cols-3 content-start gap-2 overflow-y-auto overscroll-contain pr-1">
                  {albums === null && Array.from({ length: 9 }, (_, i) => <li key={i} className="aspect-square animate-pulse rounded-[3px] bg-(--ink)/8" />)}
                  {albums?.length === 0 && <li className="col-span-3 py-6 text-center text-[13px] text-(--ink)/55">찾는 앨범이 없어요.</li>}
                  {albums?.map((a) => {
                    const on = source?.key === `album:${a.slug}`;
                    return (
                      <li key={a.slug}>
                        <button type="button" onClick={() => pickAlbum(a)} title={`${a.title} — ${a.artist_names}`} aria-pressed={on}
                          className="block aspect-square w-full overflow-hidden rounded-[3px] outline-offset-2 transition-transform hover:-translate-y-0.5 aria-pressed:outline aria-pressed:outline-2 aria-pressed:outline-(--accent)"
                          style={{ background: a.cover_color || undefined }}>
                          <img src={coverUrl(a.thumb_path)} alt={a.title} loading="lazy" decoding="async" draggable={false} className="size-full select-none object-cover" />
                        </button>
                      </li>
                    );
                  })}
                  {moreAlbums && albums && <li className="col-span-3 py-3 text-center text-[11px] uppercase tracking-[0.2em] text-(--ink)/45">
                    <button type="button" onClick={loadMore} className="min-h-9 px-4 hover:text-(--ink)">더 보기 ↓</button></li>}
                </ul>
              </>
            ) : (
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); onFile(e.dataTransfer.files?.[0]); }}
                className="mt-3 grid place-items-center gap-3 rounded-[4px] border-2 border-dashed border-(--ink)/30 px-4 py-10 text-center">
                <p className="text-[14px] text-(--ink)/75">사진을 끌어다 놓거나</p>
                <button type="button" onClick={() => fileRef.current?.click()} className="min-h-11 rounded-full bg-(--ink) px-6 text-[12px] font-medium uppercase tracking-[0.18em] text-(--cream) hover:bg-(--accent)">Choose image</button>
                <p className="text-[11px] leading-5 text-(--ink)/50">사진은 이 브라우저 안에서만 쓰이고 서버에 올라가지 않아요.</p>
                <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ""; }} />
              </div>
            )}
          </div>

          <div className={`${PANEL} grid gap-3 p-4`}>
            <div className="flex items-baseline justify-between">
              <p className={LABEL}>Adjust</p>
              <button type="button" onClick={() => setAdj({ brightness: 0, contrast: 0, saturation: 0, dither: false, maxColors: 0 })} className="text-[11px] uppercase tracking-[0.18em] text-(--ink)/55 hover:text-(--ink)">Reset</button>
            </div>
            <Slider label="밝기" value={adj.brightness} onChange={set("brightness")} />
            <Slider label="대비" value={adj.contrast} onChange={set("contrast")} />
            <Slider label="채도" value={adj.saturation} onChange={set("saturation")} />
            <label className="grid grid-cols-[64px_1fr] items-center gap-3 text-[13px]">
              <span className="text-(--ink)/75">색 수</span>
              <select value={adj.maxColors} onChange={(e) => set("maxColors")(Number(e.target.value))} className="h-9 rounded-full border border-(--ink)/30 bg-transparent px-3 text-[13px]">
                <option value={0}>제한 없음 ({PALETTE.length}색 중)</option>
                {[6, 8, 12, 16, 20].map((v) => <option key={v} value={v}>최대 {v}색</option>)}
              </select>
            </label>
            <label className="flex items-center justify-between gap-3 text-[13px]">
              <span className="text-(--ink)/75">디더링 <span className="text-[11px] text-(--ink)/45">점을 섞어 중간색 표현</span></span>
              <input type="checkbox" checked={adj.dither} onChange={(e) => set("dither")(e.target.checked)} className="size-4 accent-(--accent)" />
            </label>
          </div>
        </section>
      </div>

      {cropping && (
        <CropDialog img={cropping.img} onCancel={() => setCropping(null)}
          onDone={(crop) => { setSource({ key: `upload:${Date.now()}`, title: cropping.name || "My image", sub: "", img: cropping.img, crop }); setCropping(null); }} />
      )}
    </div>
  );
}

const count5 = (c) => c + Math.ceil(c * SPARE);
