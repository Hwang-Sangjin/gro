"use client";
// /lab/spin — 조에트로프 판: 프레임을 판 둘레에 놓고, 판이 한 칸 돌 때마다 빛을 비추면 멈춘 그림이 움직여 보임
// 가운데 큰 판(2D 캔버스 / 3D 턴테이블) · 오른쪽 Disc·Strobe · 아래 Source·Frames · 맨 아래 원리 설명
// 스트로브 흉내: 빛이 켜지는 순간(1초에 RPM × 칸 수 ÷ 60 번)의 판만 그리고, 그 사이엔 마지막 장면을 붙잡아 둠
//  (실제처럼 사이를 까맣게 하면 1초 9번쯤 깜빡여 눈이 아프고 광과민 위험이 있어서)
import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import useLabReveal from "@/components/lab/useLabReveal";
import GrooveText from "@/components/lab/GrooveText";
import { SERIF, LABEL, ShownCtx, Reveal, Heading } from "@/components/lab/LabUI";
import { S, D, RPM, rpmLabel, demoFrames, textFrames, decodeFile, fileFrames, buildDisc, makeSheen } from "@/lib/spin/frames";

const SpinTurntable = dynamic(() => import("./SpinTurntable"), { ssr: false, loading: () => <div className="size-full animate-pulse rounded-[18px] bg-(--ink)/8" /> });

const PILL = "min-h-10 rounded-full border border-(--ink)/40 px-5 text-[12px] font-medium uppercase tracking-[0.18em] transition-colors hover:border-(--ink) aria-pressed:border-(--ink) aria-pressed:bg-(--ink) aria-pressed:text-(--cream) disabled:opacity-40";

function Seg({ label, value, options, onChange, small }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-full border border-(--ink)/40 p-1">
      {options.map(([v, l]) => (
        <button key={v} type="button" role="radio" aria-checked={value === v} onClick={() => onChange(v)}
          className={`rounded-full font-medium uppercase transition-colors aria-checked:bg-(--ink) aria-checked:text-(--cream) ${small ? "min-h-8 px-3 text-[11px] tracking-[0.14em]" : "min-h-9 px-4 text-[12px] tracking-[0.18em]"}`}>{l}</button>
      ))}
    </div>
  );
}

function Row({ label, children, i }) {
  return (
    <Reveal i={i} className="grid grid-cols-[60px_minmax(0,1fr)] items-center gap-3 border-b border-dashed border-(--ink)/25 py-3">
      <span className={LABEL}>{label}</span>
      <div className="flex min-w-0 flex-wrap items-center gap-2">{children}</div>
    </Reveal>
  );
}

// 프레임 목록 한 칸
function Thumb({ frame, dark, i }) {
  const ref = useRef(null);
  useEffect(() => {
    const g = ref.current?.getContext("2d");
    if (!g) return;
    g.clearRect(0, 0, 96, 96);
    g.drawImage(frame, 0, 0, 96, 96);
  }, [frame]);
  return (
    <figure className="m-0 grid gap-1">
      <canvas ref={ref} width={96} height={96} className={`aspect-square w-full rounded-[4px] ${dark ? "bg-[#151214]" : "bg-[repeating-conic-gradient(rgba(76,64,74,.08)_0_25%,transparent_0_50%)] bg-size-[12px_12px]"}`} />
      <figcaption className="text-center text-[10px] tabular-nums text-(--ink)/55">{String(i + 1).padStart(2, "0")}</figcaption>
    </figure>
  );
}

const STEPS = [
  ["어두운 방", "스트로브는 1/1000초쯤 번쩍이고 나머지 시간은 꺼져 있어요. 빛이 없는 동안은 판이 돌아도 보이는 게 없고, 번쩍인 순간만 눈에 들어옵니다."],
  ["멈춘 사진", "번쩍임이 아주 짧아서 그 사이 판은 거의 움직이지 않아요. 플래시를 터뜨린 사진처럼 번지지 않고 또렷하게 멈춰 보입니다."],
  ["딱 한 칸", "다음 번쩍임 때 판은 정확히 한 칸(360° ÷ 프레임 수) 돌아 있어요. 같은 자리에 매번 바로 다음 프레임이 와 있습니다."],
  ["뇌가 잇기", "조금씩 다른 정지 그림이 빠르게 이어지면 뇌가 그 사이를 움직임으로 채워요. 플립북, 그리고 1초 24장 사이마다 셔터가 닫히는 영화와 같은 원리예요."],
];
const CAMERA = [["33⅓ RPM", "30 fps", "6.67°", 54], ["33⅓ RPM", "25 fps", "8°", 45], ["45 RPM", "30 fps", "9°", 40]];

export default function SpinStudio() {
  const shown = useLabReveal();
  const [src, setSrc] = useState("demo");
  const [n, setN] = useState(16);
  const [rpm, setRpm] = useState(RPM["33"]);
  const [style, setStyle] = useState("black");
  const [strobe, setStrobe] = useState(true);
  const [slow, setSlow] = useState(false);
  const [detune, setDetune] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [view, setView] = useState("2d");
  const [text, setText] = useState("GROOVES");
  const [effect, setEffect] = useState("wave");
  const [font, setFont] = useState("bold");
  const [keyOn, setKeyOn] = useState(true);
  const [tol, setTol] = useState(38);
  const [raw, setRaw] = useState(null);           // 올린 파일 { list, total, name, key }
  const [fileMsg, setFileMsg] = useState({ text: "", warn: false, busy: false });
  const [frames, setFrames] = useState([]);
  const [version, setVersion] = useState(0);      // 판 그림이 바뀔 때마다 +1 (3D 텍스처 갱신)
  const [fontsReady, setFontsReady] = useState(0);
  const [disc, setDisc] = useState(null);         // 구운 판 (D×D 캔버스)
  const [drag, setDrag] = useState(false);

  const view2d = useRef(null);
  const box = useRef(null);
  const motion = useRef({ angle: 0, pulse: 0 });
  const dirty = useRef(true);
  const live = useRef({});
  live.current = { n, rpm, style, strobe, slow, detune, playing, view, disc };

  // 처음: 판 캔버스 · 움직임 줄이기 설정 · 글꼴 기다리기
  useEffect(() => {
    const c = document.createElement("canvas");
    c.width = c.height = D;
    setDisc(c);
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) setPlaying(false);
    Promise.all(["40px 'Black Han Sans'", "40px 'Monoton'"].map((f) => document.fonts.load(f).catch(() => {})))
      .then(() => setFontsReady((v) => v + 1));
  }, []);

  // 프레임 만들기 → 판 굽기 (글자는 타이핑 멈추면)
  useEffect(() => {
    if (!disc) return;
    const run = () => {
      const list = src === "text" ? textFrames(n, { text, effect, font, style })
        : src === "file" && raw ? fileFrames(raw, n, { key: keyOn, tol })
        : demoFrames(n, style);
      buildDisc(disc, list, { style, rpm });
      setFrames(list);
      setVersion((v) => v + 1);
      dirty.current = true;
    };
    const t = setTimeout(run, src === "text" || src === "file" ? 120 : 0);
    return () => clearTimeout(t);
  }, [disc, src, n, style, rpm, text, effect, font, raw, keyOn, tol, fontsReady]);

  // 2D 캔버스 크기 = 보이는 크기 × 화면 배율 (최대 1100)
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const cv = view2d.current;
      const px = Math.min(1100, Math.round(el.getBoundingClientRect().width * (devicePixelRatio || 1)));
      if (cv && px && cv.width !== px) { cv.width = cv.height = px; dirty.current = true; }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // 재생 루프 — 판은 계속 돌고(simT), 스트로브면 빛 켜진 순간의 각도만 보여 줌
  useEffect(() => {
    const sheen = makeSheen();
    let raf = 0, last = performance.now(), simT = 0, lastKey = "", lastK = -1, flashAt = -1e9;
    const draw = (cv, s, angle, blur, pulse) => {
      const g = cv.getContext("2d"), W = cv.width;
      g.clearRect(0, 0, W, W);
      const one = (a, alpha) => {
        g.save(); g.globalAlpha = alpha; g.translate(W / 2, W / 2); g.rotate((a * Math.PI) / 180);
        g.drawImage(s.disc, -W / 2, -W / 2, W, W); g.restore();
      };
      // 계속 비출 때: 눈이 1/30초 동안 본 걸 같은 무게로 겹침 (i번째를 1/(i+1)로 덮으면 평균)
      if (blur) { const taps = 14, spread = (s.rpm * 6) / 30; for (let i = 0; i < taps; i++) one(angle - (spread * i) / (taps - 1), 1 / (i + 1)); }
      else one(angle, 1);
      if (s.style === "black") g.drawImage(sheen, 0, 0, W, W);
      if (pulse > 0) { g.save(); g.globalAlpha = pulse * 0.28; g.fillStyle = "#fffaf0"; g.beginPath(); g.arc(W / 2, W / 2, W / 2, 0, 7); g.fill(); g.restore(); }
    };
    const tick = (now) => {
      const s = live.current;
      const dt = Math.min(0.1, (now - last) / 1000); last = now;
      if (s.playing) simT += dt * (s.slow ? 1 / 8 : 1);
      const omega = s.rpm * 6, f = ((s.rpm * s.n) / 60) * (1 + s.detune), k = Math.floor(simT * f);
      const cv = view2d.current;
      let angle, needs = dirty.current;
      if (s.strobe && !s.slow) {
        angle = (k / f) * omega;
        const key = `${k}:${cv?.width}`;
        if (key !== lastKey) { lastKey = key; needs = true; }
      } else {
        angle = simT * omega; needs = true;
        if (s.strobe && k !== lastK) { lastK = k; flashAt = now; }   // 슬로모션: 빛이 켜지는 순간 반짝
      }
      const pulse = s.strobe && s.slow ? Math.max(0, 1 - (now - flashAt) / 160) : 0;
      motion.current.angle = angle; motion.current.pulse = pulse;
      if (s.view === "2d" && cv && s.disc && (needs || pulse > 0)) { draw(cv, s, angle, !s.strobe && s.playing && !s.slow, pulse); dirty.current = false; }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  useEffect(() => { dirty.current = true; }, [strobe, slow, view, playing]);

  const loadFile = async (file) => {
    if (!file) return;
    setSrc("file");
    setFileMsg({ text: `${file.name} 읽는 중…`, warn: false, busy: true });
    try {
      const r = await decodeFile(file);
      setRaw(r);
      setFileMsg({ text: "", warn: false, busy: false });
    } catch (e) {
      setFileMsg({ text: e?.message || "파일을 읽지 못했어요.", warn: true, busy: false });
    }
  };
  const dropProps = {
    onDragOver: (e) => { e.preventDefault(); setDrag(true); },
    onDragLeave: () => setDrag(false),
    onDrop: (e) => { e.preventDefault(); setDrag(false); loadFile(e.dataTransfer.files?.[0]); },
  };

  const f = ((rpm * n) / 60) * (1 + detune), rev = 60 / rpm;
  const readout = slow && strobe ? <><b className="font-medium text-(--ink)">Slow-mo ⅛×</b> · 판은 계속 돌고, 반짝이는 순간이 빛이 켜지는 때예요. 위 표시 자리에 다음 프레임이 와 있는지 보세요</>
    : slow ? <><b className="font-medium text-(--ink)">Slow-mo ⅛×</b> · 빛이 계속 켜져 있으면 판이 그냥 돌기만 해요</>
    : strobe ? <><b className="font-medium text-(--ink)">{rpmLabel(rpm)} RPM</b> · 한 칸 {(360 / n).toFixed(1)}° · 빛 <b className="font-medium text-(--ink)">{f.toFixed(1)}회/초</b> = 보이는 fps · 한 바퀴 {rev.toFixed(2)}초</>
    : <><b className="font-medium text-(--ink)">Strobe off</b> · 계속 비추면 판이 그냥 번져 보여요</>;

  const fileInfo = raw && !fileMsg.busy && !fileMsg.warn ? (() => {
    const k = raw.key;
    const bg = k.kind === "clear" ? "이미 투명한 배경이라 그대로 씀"
      : k.kind === "busy" ? "배경이 단색이 아니라 그대로 둠 (네모 칸으로 들어감)"
      : keyOn ? `배경 rgb(${k.rgb.join(",")}) 지움` : `배경 rgb(${k.rgb.join(",")}) 남겨 둠`;
    return { warn: k.kind === "busy", lines: [raw.name, `원본 ${raw.list.length}프레임 · ${raw.total.toFixed(2)}초 → ${n}장으로 나눔`, bg, `판에서는 ${rev.toFixed(2)}초에 한 번 (원본의 ${(raw.total / rev).toFixed(2)}배 빠르기)`] };
  })() : null;

  return (
    <ShownCtx.Provider value={shown}>
    <div className="mx-auto w-full max-w-[1600px] px-[clamp(16px,3.2vw,44px)] pb-20 pt-[calc(var(--ct-header-h,106px)+14px)] text-(--ink)">
      {/* 제목 줄 */}
      <header className="flex flex-wrap items-end justify-between gap-x-8 gap-y-2 border-b-[3px] border-(--ink) pb-3">
        <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
          <GrooveText as="h1" className="text-[clamp(2.1rem,4vw,3.6rem)] leading-[1.05]">Spin it.</GrooveText>
          <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-(--accent)">Lab · Spin</p>
        </div>
        <p className="max-w-[52ch] break-keep text-[13px] leading-6 text-(--ink)/70 max-md:hidden">판 둘레에 프레임을 놓고, 판이 한 칸 도는 순간마다 빛을 비추면 멈춘 그림이 움직이기 시작해요. 글자를 쓰거나 GIF·WebP·짧은 영상을 올려 보세요.</p>
        <p className="text-right text-[11px] uppercase tracking-[0.2em] text-(--ink)/65 tabular-nums">
          <span className={`${SERIF} mr-3 text-[clamp(1.4rem,2.2vw,2rem)] normal-case tracking-normal text-(--ink)`}>{rpmLabel(rpm)}</span>
          rpm · {n} frames
        </p>
      </header>

      <div className="mt-6 grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[minmax(0,1fr)_290px] lg:items-start">
        {/* 판 */}
        <section aria-label="Disc" className="grid gap-4">
          <div ref={box} {...dropProps} data-on={shown}
            className={`relative mx-auto aspect-square w-full max-w-[min(100%,calc(100svh-250px),860px)] min-w-[260px] opacity-0 transition-opacity duration-500 data-[on=true]:opacity-100 ${drag ? "rounded-full outline-2 outline-offset-8 outline-dashed outline-(--accent)" : ""}`}>
            {view === "2d" && <span aria-hidden="true" className="absolute -top-3 left-1/2 -translate-x-1/2 border-x-[7px] border-t-[10px] border-x-transparent border-t-(--accent)" />}
            <canvas ref={view2d} width={1000} height={1000} hidden={view !== "2d"} aria-label="프레임이 둘러 놓인 회전하는 판" className="block size-full rounded-full" />
            {view === "3d" && disc && (
              <div data-lenis-prevent data-crate-ignore className="absolute inset-0 cursor-grab active:cursor-grabbing">
                <SpinTurntable className="size-full" disc={disc} version={version} motion={motion} />
              </div>
            )}
          </div>
          <Reveal i={2} className="flex flex-wrap items-center justify-center gap-2.5">
            <Seg label="보기" value={view} onChange={setView} options={[["2d", "2D"], ["3d", "3D"]]} />
            <button type="button" onClick={() => setPlaying((p) => !p)} className={`${PILL} border-(--accent) bg-(--accent) text-(--cream) hover:border-(--accent)`}>{playing ? "Pause" : "Play"}</button>
            <button type="button" aria-pressed={strobe} onClick={() => setStrobe((v) => !v)} className={PILL}>{strobe ? "Strobe on" : "Strobe off"}</button>
            <button type="button" aria-pressed={slow} onClick={() => setSlow((v) => !v)} className={PILL}>Slow-mo ⅛×</button>
          </Reveal>
          <Reveal i={3} as="p" className="mx-auto max-w-[64ch] break-keep text-center text-[12px] leading-5 text-(--ink)/60 tabular-nums">
            {readout}{view === "3d" && <><br />드래그해서 돌려 보고, 휠·핀치로 가까이</>}
          </Reveal>
        </section>

        {/* 오른쪽: 판 · 빛 */}
        <aside className="grid content-start gap-7">
          <section aria-label="Disc settings">
            <Heading n="01" title="Disc" />
            <Row label="RPM" i={1}><Seg small label="회전 속도" value={rpm} onChange={setRpm} options={[[RPM["33"], "33⅓"], [RPM["45"], "45"]]} /></Row>
            <Row label="Frames" i={2}><Seg small label="프레임 수" value={n} onChange={setN} options={[[12, "12"], [16, "16"], [24, "24"]]} /></Row>
            <Row label="Press" i={3}><Seg small label="판 종류" value={style} onChange={setStyle} options={[["black", "Black"], ["picture", "Picture"]]} /></Row>
          </section>
          <section aria-label="Strobe settings">
            <Heading n="02" title="Strobe" />
            <Row label="Detune" i={1}>
              <input type="range" min="-40" max="40" value={Math.round(detune * 1000)} onChange={(e) => setDetune(Number(e.target.value) / 1000)} aria-label="스트로브 어긋남" className="h-1 min-w-0 flex-1 cursor-pointer accent-(--accent)" />
              <span className="w-12 text-right text-[11px] tabular-nums text-(--ink)/60">{detune >= 0 ? "+" : ""}{(detune * 100).toFixed(1)}%</span>
            </Row>
            <Reveal i={2} as="p" className="mt-3 break-keep text-[12.5px] leading-[1.7] text-(--ink)/65">빛 간격이 판 한 칸과 딱 맞으면 그림은 제자리에서 움직이고, 조금 어긋나면 그림 전체가 판 둘레를 천천히 앞으로 혹은 뒤로 흘러가요. 실제 판에서는 회전 속도의 작은 흔들림이 이렇게 보여요.</Reveal>
          </section>
        </aside>
      </div>

      {/* 아래: 소스 · 프레임 */}
      <div className="mt-12 grid grid-cols-[minmax(0,1fr)] gap-10 lg:grid-cols-2">
        <section aria-label="Source">
          <Heading n="03" title="Source" note={src === "file" && !raw ? "파일을 올리면 바뀜" : undefined} />
          <Reveal i={1} className="mt-1"><Seg label="소스" value={src} onChange={setSrc} options={[["demo", "Demo"], ["text", "Text"], ["file", "File"]]} /></Reveal>
          <Reveal i={2} className="mt-4">
            {src === "demo" && <p className="break-keep text-[13px] leading-6 text-(--ink)/65">통통 튀는 공 한 번이 프레임 수만큼 나뉘어 판에 놓였어요. 판 위쪽 청록 표시 자리를 보면 한 장씩 넘어가는 게 보여요.</p>}
            {src === "text" && (
              <div className="grid gap-3">
                <input type="text" maxLength={10} value={text} onChange={(e) => setText(e.target.value)} aria-label="판에 넣을 글자"
                  className="w-full rounded-[6px] border border-(--ink)/30 bg-transparent px-3 py-2.5 text-[17px] outline-none focus-visible:border-(--accent)" />
                <div className="flex flex-wrap gap-2">
                  <select value={effect} onChange={(e) => setEffect(e.target.value)} aria-label="움직임" className="rounded-[6px] border border-(--ink)/30 bg-transparent px-3 py-2 text-[13px]">
                    <option value="wave">Wave · 글자가 물결</option>
                    <option value="spin">Spin · 통째로 회전</option>
                    <option value="pulse">Pulse · 커졌다 작아짐</option>
                    <option value="type">Type · 한 글자씩</option>
                  </select>
                  <select value={font} onChange={(e) => setFont(e.target.value)} aria-label="글꼴" className="rounded-[6px] border border-(--ink)/30 bg-transparent px-3 py-2 text-[13px]">
                    <option value="bold">굵게 (Black Han Sans)</option>
                    <option value="groove">줄무늬 (Monoton)</option>
                  </select>
                </div>
              </div>
            )}
            {src === "file" && (
              <div className="grid gap-3">
                <label {...dropProps} className={`relative grid cursor-pointer place-items-center gap-1 rounded-[8px] border border-dashed px-4 py-6 text-center transition-colors focus-within:outline-2 focus-within:outline-(--accent) ${drag ? "border-(--accent) bg-(--accent)/8" : "border-(--ink)/40 hover:border-(--ink)"}`}>
                  <span className="text-[14px] font-semibold">파일을 고르거나 여기·판 위로 끌어 놓기</span>
                  <span className="text-[12px] text-(--ink)/60">GIF · 움직이는 WebP/PNG · MP4/WebM (앞 4초)</span>
                  <input type="file" accept="image/gif,image/webp,image/png,image/apng,video/*" onChange={(e) => loadFile(e.target.files?.[0])} className="absolute size-px opacity-0" />
                </label>
                <div className="flex flex-wrap items-center gap-3">
                  <button type="button" aria-pressed={keyOn} disabled={raw ? raw.key.kind !== "solid" : false} onClick={() => setKeyOn((v) => !v)} className={`${PILL} min-h-9 px-4 text-[11px]`}>배경 지우기 {keyOn ? "on" : "off"}</button>
                  <span className={LABEL}>범위</span>
                  <input type="range" min="8" max="90" value={tol} onChange={(e) => setTol(Number(e.target.value))} aria-label="배경 지우는 범위" className="h-1 min-w-0 flex-1 cursor-pointer accent-(--accent)" />
                </div>
                <p role="status" className={`border-l-[3px] py-1.5 pl-3 text-[12px] leading-[1.7] ${fileMsg.warn || fileInfo?.warn ? "border-[#b7793f]" : "border-(--accent)"}`}>
                  {fileMsg.text || (fileInfo ? fileInfo.lines.map((l, i) => <span key={i} className="block">{l}</span>) : "아직 올린 파일이 없어요. 초록·파랑·단색 배경이면 네 모서리 색을 읽어 자동으로 지워요.")}
                </p>
              </div>
            )}
          </Reveal>
        </section>
        <section aria-label="Frames">
          <Heading n="04" title="Frames" note={`${frames.length}장 · ${S}px`} />
          <Reveal i={1} className="grid grid-cols-[repeat(auto-fill,minmax(52px,1fr))] gap-1.5">
            {frames.map((fr, i) => <Thumb key={`${version}-${i}`} frame={fr} dark={style === "black"} i={i} />)}
          </Reveal>
        </section>
      </div>

      {/* 원리 */}
      <article aria-labelledby="spin-why" className="mt-16 grid gap-5">
        <Heading n="05" title="Why it moves" />
        <Reveal i={1} as="h2" id="spin-why" className={`${SERIF} text-[clamp(1.6rem,3vw,2.2rem)] leading-tight`}>왜 움직여 보일까</Reveal>
        <Reveal i={2} as="p" className="max-w-[62ch] break-keep text-[15px] leading-7 text-(--ink)/80">
          밝은 방에서 그냥 돌리면 눈이 판을 연속으로 보기 때문에 그림은 번지기만 해요(Strobe off). 움직이는 그림은 눈이 판을 <b className="font-semibold text-(--accent)">띄엄띄엄</b> 볼 때만 생겨요.
        </Reveal>
        <div className="grid grid-cols-[minmax(0,1fr)] gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {STEPS.map(([t, d], i) => (
            <Reveal key={t} i={3 + i} className="border-t border-(--ink)/25 pt-2.5">
              <p className={LABEL}>{t}</p>
              <p className="mt-1.5 break-keep text-[13.5px] leading-[1.75] text-(--ink)/80">{d}</p>
            </Reveal>
          ))}
        </div>
        <Reveal i={7} as="h3" className={`${SERIF} mt-6 text-[1.3rem]`}>실제 판은 어떻게 보나</Reveal>
        <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-3">
          <Reveal i={8} className="border-t border-(--ink)/25 pt-2.5">
            <p className={LABEL}>스트로브 조명</p>
            <p className="mt-1.5 break-keep text-[13.5px] leading-[1.75] text-(--ink)/80">방을 어둡게 하고 번쩍이는 속도를 칸에 맞추면 맨눈으로 보여요. 속도가 정확해야 하고 깜빡임이 강해서, 이 페이지는 깜빡임 없이 마지막 장면을 붙잡아 두는 방식으로 흉내 내요.</p>
          </Reveal>
          <Reveal i={9} className="border-t border-(--ink)/25 pt-2.5">
            <p className={LABEL}>폰 카메라</p>
            <p className="mt-1.5 break-keep text-[13.5px] leading-[1.75] text-(--ink)/80">가장 흔한 방법이에요. 카메라가 1초에 30장씩 끊어 찍는 게 스트로브 역할을 해서, 맨눈엔 번지는 판이 영상에서는 움직여요. 대신 칸 수를 촬영 속도에 맞춰야 하고, 밝은 곳에서 찍어야 덜 번져요.</p>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full border-collapse text-left text-[12px] tabular-nums">
                <thead><tr className="text-(--ink)/55">{["회전", "촬영", "한 장마다", "칸 수"].map((h) => <th key={h} className="whitespace-nowrap border-b border-(--ink)/25 py-1.5 pr-3 font-medium tracking-[0.06em]">{h}</th>)}</tr></thead>
                <tbody>{CAMERA.map((r) => <tr key={r.join()}>{r.map((c, i) => <td key={i} className={`whitespace-nowrap border-b border-dashed border-(--ink)/20 py-1.5 pr-3 ${i === 3 ? "font-medium text-(--accent)" : ""}`}>{c}</td>)}</tr>)}</tbody>
              </table>
            </div>
          </Reveal>
          <Reveal i={10} className="border-t border-(--ink)/25 pt-2.5">
            <p className={LABEL}>틈새로 보기</p>
            <p className="mt-1.5 break-keep text-[13.5px] leading-[1.75] text-(--ink)/80">옛날 조에트로프 방식이에요. 좁은 틈 너머로 보면 틈이 지나가는 순간에만 안이 보여서, 빛 없이도 같은 효과가 나요.</p>
          </Reveal>
        </div>
      </article>
    </div>
    </ShownCtx.Provider>
  );
}
