"use client";
// Crate 보기의 글자 층: 맨 앞 판의 정보 패널 · 버튼 · 위치 표시줄 (CrateView 가 덮개 안에 그림)
//  넓은 화면(820px 이상): 왼쪽에 패널, 그 오른쪽에 판 (자리 나눔은 crateEngine.crateLayout 과 같은 CSS 변수)
//  좁은 화면: 판 아래에 한 덩어리로
//  예전에는 제목과 아티스트만 화면 아래 양 끝에 있었고, 무엇을 하려면 판을 눌러 상세로 들어가야 했음
const SERIF = "font-['Grooves_Display','Hahmlet',Georgia,serif]";
const KICKER = "text-[11px] font-medium uppercase tracking-[0.24em]";
const PILL = "pointer-events-auto inline-flex min-h-11 items-center gap-2 rounded-full border px-5 text-[12px] font-semibold uppercase tracking-[0.16em] transition-[background-color,color,border-color,opacity,scale] duration-300 active:scale-[.97]";
const pad3 = (n) => String(n).padStart(3, "0");
const rpmText = (rpm) => (rpm ? `${rpm === 33 ? "33⅓" : rpm} RPM` : "");

function Icon({ name, on }) {
  if (name === "play") return <svg aria-hidden="true" viewBox="0 0 16 16" className="size-3" fill="currentColor"><path d="M4.5 2.5v11l9-5.5z" /></svg>;
  if (name === "pause") return <svg aria-hidden="true" viewBox="0 0 16 16" className="size-3" fill="currentColor"><path d="M4 3h3v10H4zM9 3h3v10H9z" /></svg>;
  if (name === "heart") return (
    <svg aria-hidden="true" viewBox="0 0 16 16" className="size-3.5" fill={on ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round">
      <path d="M8 13.5S2 10 2 5.9A3 3 0 0 1 8 4.4a3 3 0 0 1 6 1.5C14 10 8 13.5 8 13.5Z" />
    </svg>
  );
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="1.4">
      <circle cx="8" cy="8" r="6" fill={on ? "currentColor" : "none"} /><circle cx="8" cy="8" r="1.6" stroke={on ? "var(--bg)" : "currentColor"} fill={on ? "var(--bg)" : "none"} />
    </svg>
  );
}

// 판 정보 줄 (값이 있는 것만): 연도 · 포맷 · 장르 · 곡 수
function facts(info) {
  if (!info) return [];
  const genres = (info.album_genres ?? []).map((g) => g.genres?.name).filter(Boolean).slice(0, 2).join(" · ");
  const tracks = info.tracks?.[0]?.count;
  return [
    ["Year", info.release_year],
    ["Format", [info.format, rpmText(info.rpm)].filter(Boolean).join(" · ")],
    ["Genre", genres],
    ["Tracks", tracks || null],
  ].filter(([, v]) => v);
}

/**
 * label: 어디의 상자인지 (Digging · Owned …) · toggle: Grid / Crate 스위치 · front: 맨 앞 판 { i, n, divider, title, artist, color, slug } · total: 전체 판 수
 * info: 맨 앞 판의 상세 (없으면 아직 받는 중) · kind: 내 선반에서의 자리 ("owned" | "wishlist" | null)
 * listening: 이 판을 지금 틀고 있음 · onOpen · onListen · onShelf(kind) · sound: 소리 켜기 버튼 (어디의 상자인지 옆)
 */
export default function CratePanel({ label, toggle, sound = null, front, total, info, kind, listening, onOpen, onListen, onShelf, mode = "crate", marks = [], onJump }) {
  const L = mode === "listen";   // Listening: 아래에 책등 선반이 있어 패널을 짧게 · 좁은 화면에서도 듣기 버튼
  const n = front ? Math.max(front.n, total ?? 0) : 0;
  const rows = front && !front.divider ? facts(info) : [];
  // 제목 색: 커버 색을 잉크에 섞음. 35%만 — 흰 커버여도 종이 위에서 대비 3:1 이 나오게 (예전 55% 는 밝은 커버에서 2:1)
  const tint = { color: `color-mix(in oklab, ${front?.color || "var(--ink)"} 35%, var(--ink))` };
  const canListen = !!info?.youtube_playlist_id;
  const at = front && !front.divider && n > 0 ? (front.i + 0.5) / n : 0;

  const actions = front && !front.divider && (
    <>
      <div className="flex flex-wrap gap-2">
        {/* 듣기: 넓은 화면에서만 (작은 플레이어 카드가 상자 옆에 뜸). 좁은 화면은 상세 페이지에서 */}
        {canListen && (
          <button type="button" onClick={onListen} aria-pressed={listening} className={`${PILL} ${L ? "" : "max-[819px]:hidden"} border-(--ink) bg-(--ink) text-(--cream) hover:opacity-85`}>
            <Icon name={listening ? "pause" : "play"} />{listening ? "Pause" : "Listen"}
          </button>
        )}
        <button type="button" onClick={onOpen} className={`${PILL} ${canListen ? "border-(--ink)/45 hover:border-(--ink) max-[819px]:border-(--ink) max-[819px]:bg-(--ink) max-[819px]:text-(--cream)" : "border-(--ink) bg-(--ink) text-(--cream) hover:opacity-85"}`}>
          {L ? "Album page" : "Open record"} <span aria-hidden="true">→</span>
        </button>
      </div>
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1" role="group" aria-label="Add to my shelves">
        {[["owned", "I own this", "In your collection", "disc"], ["wishlist", "Wishlist", "On your wishlist", "heart"]].map(([k, off, on, icon]) => (
          <button key={k} type="button" aria-pressed={kind === k} disabled={!info} onClick={() => onShelf(k)}
            className={`pointer-events-auto inline-flex min-h-9 items-center gap-1.5 ${KICKER} transition-opacity duration-300 hover:opacity-100 disabled:opacity-30 ${kind === k ? "opacity-100" : "opacity-65"}`}>
            <Icon name={icon} on={kind === k} />{kind === k ? on : off}
          </button>
        ))}
      </div>
    </>
  );

  return (
    <div className="pointer-events-none absolute inset-0 text-(--ink)" style={{ opacity: "max(0, 1 - var(--crate-m) * 5)" }}>
      {/* 위: 어디의 상자인지 (예전의 큰 "DIGGING" 제목 대신 — 그리드와 글꼴이 달랐고 상자 탭과 겹쳤음) · 보기 전환 */}
      <div className="absolute left-[var(--crate-gut)] top-[calc(var(--ct-header-h,106px)+0.6rem)] flex min-h-9 items-center gap-5 max-[819px]:gap-3">
        <p className={`${KICKER} opacity-70`}>{label}<span className="max-[819px]:hidden"> · {L ? "Listening" : "Crate"}</span></p>
        {sound}
      </div>
      <div className="pointer-events-auto absolute right-[var(--crate-gut)] top-[calc(var(--ct-header-h,106px)+0.6rem)]">
        {/* 판 더미가 이 자리까지 올라오므로 종이 바탕을 깔아 줌 */}
        {toggle}
      </div>

      {/* 글자 칸막이로 바로 가기 (아티스트 A–Z 로 볼 때만) */}
      {marks.length > 1 && (
        <div role="group" aria-label="Jump to a letter" className={`pointer-events-auto absolute left-1/2 flex min-h-9 -translate-x-1/2 items-center gap-1 rounded-full bg-(--bg)/85 px-1 backdrop-blur-sm ${L ? "top-[calc(var(--ct-header-h,106px)+0.6rem)] max-[819px]:top-[calc(var(--ct-header-h,106px)+3rem)]" : "bottom-[clamp(2.25rem,5.5vh,3.25rem)]"}`}>
          {marks.map((m) => (
            <button key={m.i} type="button" onClick={() => onJump?.(m.i)}
              className={`min-h-8 rounded-full px-3 ${KICKER} tracking-[0.12em] transition-colors duration-300 hover:bg-(--ink) hover:text-(--cream) ${front?.letter === m.label ? "bg-(--ink) text-(--cream)" : "opacity-75"}`}>
              {m.label}
            </button>
          ))}
        </div>
      )}
      {/* 넓은 화면: 왼쪽 정보 패널 */}
      {front && (
        <div key={front.slug} className="absolute left-[var(--crate-gut)] top-[calc(var(--ct-header-h,106px)+clamp(3.25rem,9vh,6rem))] w-[var(--crate-panel)] max-[819px]:hidden">
          <p className="flex items-center gap-3">
            <span className={`${KICKER} tabular-nums opacity-70`}>{front.letter ? "Section" : front.divider ? "Start" : pad3(front.i + 1)} / {pad3(n)}</span>
            {front.isNew && <span className="rounded-full bg-[#d9603b] px-2.5 py-1 text-[10px] font-bold uppercase leading-none tracking-[0.14em] text-[#fff7ea]">New in</span>}
          </p>
          <h2 className={`${SERIF} mt-2 ${L ? "line-clamp-2" : "line-clamp-3"} text-[clamp(1.9rem,3.1vw,3.4rem)] font-black leading-[1.02] tracking-[-0.015em] [word-break:keep-all] animate-[crate-title_.7s_cubic-bezier(.22,1,.36,1)_both]`} style={tint}>{front.title}</h2>
          <p className="mt-3 truncate text-[clamp(0.95rem,1.15vw,1.15rem)]">{front.artist}</p>
          {front.divider
            ? <p className={`${KICKER} mt-6 opacity-70`}>{front.letter ? "Keep flipping →" : "Scroll, drag or press → to start digging"}</p>
            : <>
              {rows.length > 0 && L && <p className="mt-3 truncate text-[12px] tabular-nums opacity-70 transition-opacity duration-500 starting:opacity-0">{rows.map(([, v]) => v).slice(0, 3).join(" · ")}</p>}
              {rows.length > 0 && !L && (
                <dl className="mt-[clamp(1rem,2.6vh,1.75rem)] border-b border-(--ink)/25 transition-opacity duration-500 starting:opacity-0">
                  {rows.map(([k, v]) => (
                    <div key={k} className="flex items-baseline justify-between gap-4 border-t border-(--ink)/25 py-2">
                      <dt className={`${KICKER} text-[10px] opacity-65`}>{k}</dt>
                      <dd className="min-w-0 truncate text-[13px] tabular-nums">{v}</dd>
                    </div>
                  ))}
                </dl>
              )}
              {info?.description && !L && <p lang="ko" className="mt-4 line-clamp-2 text-[13px] leading-6 opacity-75 transition-opacity duration-500 starting:opacity-0 max-[999px]:hidden">{info.description}</p>}
              <div className="mt-[clamp(1rem,2.6vh,1.75rem)]">{actions}</div>
            </>}
        </div>
      )}

      {/* 좁은 화면: 판 바로 아래 한 덩어리 (판의 자리 · 크기는 crateEngine resize 의 좁은 화면 식과 같음) */}
      {front && (
        <div key={`m:${front.slug}`} className={`absolute inset-x-[var(--crate-gut)] min-[820px]:hidden ${L ? "top-[calc(var(--listen-stage-bottom,50dvh)+0.75rem)]" : "top-[calc(max(19dvh,150px)+min(70vw,34dvh)+1.5rem)]"}`}>
          <p className="flex items-center gap-3">
            <span className={`${KICKER} tabular-nums opacity-70`}>{front.letter ? "Section" : front.divider ? "Start" : pad3(front.i + 1)} / {pad3(n)}</span>
            {front.isNew && <span className="rounded-full bg-[#d9603b] px-2.5 py-1 text-[10px] font-bold uppercase leading-none tracking-[0.14em] text-[#fff7ea]">New in</span>}
          </p>
          <h2 className={`${SERIF} mt-1.5 line-clamp-2 text-[clamp(1.6rem,7vw,2.4rem)] font-black leading-[1.04] tracking-[-0.015em] [word-break:keep-all] animate-[crate-title_.7s_cubic-bezier(.22,1,.36,1)_both]`} style={tint}>{front.title}</h2>
          <p className="mt-1.5 truncate text-[15px]">{front.artist}</p>
          {front.divider
            ? <p className={`${KICKER} mt-4 opacity-70`}>Swipe to start digging</p>
            : <>
              {rows.length > 0 && <p className="mt-1.5 truncate text-[12px] tabular-nums opacity-70 transition-opacity duration-500 starting:opacity-0">{rows.map(([, v]) => v).slice(0, 3).join(" · ")}</p>}
              <div className="mt-4">{actions}</div>
            </>}
        </div>
      )}

      {/* 아래: 상자 안에서 지금 어디쯤인지 (넓은 화면은 판 아래에, 좁은 화면은 화면 폭 전체) */}
      {/* Listening: 선반 받침 (책등들이 서 있는 줄) */}
      {L && <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-[var(--listen-board,24px)] border-t-[6px] border-(--ink) bg-(--bg)" />}
      {front && n > 1 && !L && (
        <div aria-hidden="true" className="absolute bottom-[clamp(1rem,3vh,1.75rem)] left-[var(--crate-gut)] right-[var(--crate-gut)] h-px bg-(--ink)/30 min-[820px]:left-[calc(var(--crate-gut)+var(--crate-panel)+var(--crate-gap))]">
          <span className="absolute top-1/2 size-[11px] -translate-x-1/2 -translate-y-1/2 rounded-full transition-[left] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
            style={{ left: `${(at * 100).toFixed(2)}%`, backgroundColor: tint.color }} />
        </div>
      )}
      <p className={`${KICKER} absolute left-[var(--crate-gut)] text-[10px] opacity-60 max-[819px]:hidden ${L ? "bottom-[calc(var(--listen-shelf,260px)+0.25rem)]" : "bottom-[calc(clamp(1rem,3vh,1.75rem)-0.4rem)]"}`}>{L ? "Pick a spine · ← → · Space to play" : "Scroll · Drag · ← →"}</p>
    </div>
  );
}
