"use client";
// 앨범 카드 그리드 — Digging·Collection 공용
// 마우스를 올린 카드만 또렷하고 나머지는 약간 옅어짐 (Digging.module.css .card). 판(album)은 { id, slug, title, artist_names, thumb_path, cover_color }
//
// 앨범 배경 (2026-11-20): 마우스를 올리면 기본 종이 배경에서 그 앨범 상세와 같은 배경으로 서서히 넘어감
//  - 바탕: 상세 페이지와 같은 색(getAlbumTheme) + 가운데 은은한 빛 + 아래로 살짝 어두워짐 + 종이 결 (.albumBg 층 두 장, 투명도로 맞바꿈)
//  - 헤더 · 장르 바도 같은 색으로 (각자 종이색 변수만 — 결은 그대로), 글자색은 상세 페이지와 같은 규칙(foreground)
//  - 앨범을 옮겨 가면 색만 이어서 바뀌고, 그리드를 벗어나면 서서히 종이로
//  가벼움: 색 · 투명도만 바뀌는 층들 (종이 결 바탕은 그대로). 글자색 변수는 앨범이 바뀔 때 한 번만 바꿈 (매 프레임 아님)
//  (상세의 움직이는 그레인 셰이더는 넣지 않음 — 카드를 옮길 때마다 WebGL 을 돌리면 다시 무거워짐)
import { useEffect, useRef } from "react";
import AlbumCard from "./AlbumCard";
import { getAlbumTheme } from "@/lib/album-theme";
import styles from "@/components/digging/Digging.module.css";

// 바뀌는 시간 · 곡선은 CSS (Digging.module.css .page 의 --dig-fade 2초 · --dig-ease, 글자는 --dig-ink-*) — 헤더는 globals.css 에 같은 값
const ENTER_DELAY = 150;   // 카드 위에 이만큼 머물러야 바뀜 (스쳐 지나가는 카드마다 색이 바뀌지 않게)
const LEAVE_DELAY = 250;   // 그리드를 잠깐 벗어났다 돌아오는 정도면 그대로

// lead: 카드 앞에 놓이는 칸 (Digging 의 장르 칸막이) · children: 카드 뒤에 붙는 것 (더 불러오는 동안의 빈 재킷 자리)
export default function AlbumGrid({ albums, className = "", lead = null, children, ...rest }) {
  // 앨범 배경 두 장: B(위) = 지금 앨범이 나타나는 장, A(아래) = 바로 전 앨범을 그 자리 그 진하기로 붙잡아 두는 장
  //  앨범이 바뀌면 A 에 지금 모습을 옮겨 두고, B 를 새 색으로 처음부터 다시 나타나게 → 가운데에서 종이가 비치지 않고, 바뀌는 건 투명도뿐
  const layer = useRef(null);    // A
  const layerB = useRef(null);   // B
  const front = useRef(false);   // B 가 무언가 보여 주는 중
  const snap = (el, fn) => { el.style.transition = "none"; fn(); void el.offsetWidth; el.style.transition = ""; };   // 전환 없이 바로
  const els = useRef(null);
  const last = useRef(null);
  const timer = useRef(0);
  const parts = () => {
    if (els.current) return els.current;
    const page = layer.current?.closest(".page"), shell = page?.closest(".ct-page");
    const paper = page ? getComputedStyle(page).getPropertyValue("--cream").trim() : "";   // 종이색은 그대로 두려고 미리 잼
    return (els.current = { page, shell, paper, bar: page?.querySelector("[data-genre-bar]") });
  };
  const setInk = (theme) => {
    const { page, shell, paper } = parts();
    if (theme) {
      // 글자 · 버튼 색: 상세 페이지처럼 앨범 색 기준 (잉크 ↔ 크림 짝을 앨범 색으로). 종이 바탕(--dig-paper)은 원래 크림으로 묶어 둠
      page?.style.setProperty("--ink", theme.foreground);
      page?.style.setProperty("--cream", theme.background);
      if (paper) page?.style.setProperty("--dig-paper", paper);
      shell?.style.setProperty("--ct-header-fg", theme.foreground);
    } else {
      for (const k of ["--ink", "--cream", "--dig-paper"]) page?.style.removeProperty(k);
      shell?.style.removeProperty("--ct-header-fg");
    }
  };
  // 마우스가 머문 뒤에만 바꿈 (want 를 기억해 두었다가 잠시 뒤 적용)
  const want = (color) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => show(color), color ? ENTER_DELAY : LEAVE_DELAY);
  };
  const show = (color) => {
    if (color === last.current) return;
    last.current = color;
    const { shell, bar } = parts();
    const A = layer.current, B = layerB.current;
    if (!color) {
      A.style.opacity = ""; A.dataset.on = "false";   // 붙잡아 둔 진하기에서 서서히 사라짐
      B.dataset.on = "false";
      front.current = false;
      for (const k of ["--paper-surface", "--dig-paper"]) bar?.style.removeProperty(k);
      shell?.style.removeProperty("--ct-header-bg");
      setInk(null);
      return;
    }
    const theme = getAlbumTheme(color);
    const op = getComputedStyle(B).opacity;   // 사라지는 중이어도 아직 보이면 그 모습을 붙잡아 둠
    if (front.current || +op > 0.02) {
      snap(A, () => { A.style.setProperty("--dig-bg", B.style.getPropertyValue("--dig-bg")); A.style.opacity = op; A.dataset.on = "true"; });
      snap(B, () => { B.dataset.on = "false"; B.style.setProperty("--dig-bg", theme.background); });
    } else B.style.setProperty("--dig-bg", theme.background);
    B.dataset.on = "true";
    front.current = true;
    // 헤더 · 장르 바: 자기 종이(결 포함)의 색만 앨범 색으로 (상세 페이지가 헤더에 하는 것과 같음)
    for (const k of ["--paper-surface", "--dig-paper"]) bar?.style.setProperty(k, theme.background);
    shell?.style.setProperty("--ct-header-bg", theme.background);
    setInk(theme);   // 글자색도 서서히 — 배경 전환의 가운데에 짧게 (CSS --dig-ink-fade · --dig-ink-delay)
  };
  // 다른 페이지로 가면 헤더 · 바 색을 되돌림 (헤더는 페이지가 바뀌어도 남음)
  useEffect(() => () => {
    clearTimeout(timer.current);
    const p = els.current; if (!p) return;
    for (const k of ["--paper-surface", "--dig-paper"]) p.bar?.style.removeProperty(k);
    p.shell?.style.removeProperty("--ct-header-bg");
    p.shell?.style.removeProperty("--ct-header-fg");
  }, []);
  const fine = typeof window !== "undefined" && matchMedia("(hover: hover) and (pointer: fine)").matches;
  return (
    <div {...rest} data-scroll-tilt="" data-album-grid="" className={`${styles.grid} ${className}`}
      onPointerOver={fine ? (e) => { const c = e.target.closest?.("[data-album-color]"); if (c) want(c.dataset.albumColor); } : undefined}
      onPointerLeave={fine ? () => want(null) : undefined}>
      {/* 앨범 배경 층: 화면에 붙어 있음 (종이 결 위 · 카드 아래). 그리드 칸은 차지하지 않음 */}
      <div ref={layer} aria-hidden="true" data-on="false" className={styles.albumBg} />
      <div ref={layerB} aria-hidden="true" data-on="false" className={styles.albumBg} />
      {lead}
      {albums.map(album => <AlbumCard key={album.id} album={album} />)}
      {children}
    </div>
  );
}
