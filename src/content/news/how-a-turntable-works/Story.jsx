"use client";
// Vinyl A to Z 04 — "How a Turntable Works" (턴테이블 기본)
// 1 히어로(제목 · 한 줄 소개) → 2 스크롤 투어(Home 의 턴테이블, 10 단계 + 바늘 내리기 — components/story/TurntableTour.jsx) → 3 다음 이야기 · 컬렉션
// 내용은 2026-11-24 대화로 확정한 초안 그대로. 침압 숫자는 기기마다 다르므로 "카트리지 설명서의 권장값"을 기준으로 씀
import { MONOTON } from "@/lib/fonts";
import Link from "next/link";
import Reveal, { RiseText } from "@/components/story/Reveal";
import TurntableTour from "@/components/story/TurntableTour";

const WRAP = "mx-auto w-full max-w-[1500px] px-[clamp(20px,4vw,72px)]";
const LABEL = "text-[11px] font-medium uppercase tracking-[0.3em]";
const SERIF = "font-['Grooves_Display','Hahmlet',Georgia,serif] font-black tracking-[-0.01em]";

// 단계: focus = 밝힐 부품 이름(방 GLB · 투어에서 붙인 부품) · at = 초점(본체 좌표 m, focus 대신) · cam = 초점 둘레 방위(도, 0 = 정면) · 높이(도) · 거리(m)
const STEPS = [
  { n: "00", title: "The turntable", cam: { az: 28, el: 30, dist: 1.1 }, at: [0, 0.09, 0],
    body: "턴테이블은 판을 일정한 속도로 돌리고, 바늘이 홈을 따라가게 해 주는 기계예요. 스크롤하면서 부품을 하나씩 살펴봐요." },
  { n: "01", title: "Body & level", label: "Plinth · 본체", at: [0, 0.07, 0.05], labelAt: [-0.12, 0.1, 0.16], cam: { az: 8, el: 10, dist: 0.85 },
    body: "무거운 본체가 바닥과 스피커의 진동을 막아요. 수평이 기울면 바늘이 홈 한쪽에 더 눌려 소리가 치우치거나 튈 수 있어요. 수평계를 올려 두고 발 높이로 맞춰요." },
  { n: "02", title: "Platter & mat", label: "Platter · 플래터", focus: ["Turntable_Platter", "Turntable_DiscSeat"], cam: { az: 0, el: 52, dist: 0.62 },
    body: "판을 올려 돌리는 원판이에요. 무거울수록 회전이 고르고, 위의 매트는 판이 미끄러지지 않게 잡아 주며 진동을 줄여요." },
  { n: "03", title: "Speed: 33⅓ or 45", label: "Speed", at: [-0.15, 0.096, 0.138], cam: { az: -14, el: 42, dist: 0.36 },
    body: "12인치 LP는 대개 33⅓, 7인치 싱글은 45 RPM이에요. 판에 적힌 속도로 맞춰야 원래 빠르기와 음높이로 들려요.", link: ["/news/the-vinyl-dictionary", "판의 크기와 속도 → Vinyl A to Z 02"] },
  { n: "04", title: "Tonearm", label: "Tonearm · 톤암", focus: ["Tonearm_Arm", "Tonearm_Pillar", "Tonearm_Base", "Tonearm_GimbalBlock", "Tonearm_Collar"], cam: { az: 62, el: 34, dist: 0.58 },
    body: "바늘을 판 위로 옮겨 주는 팔이에요. 받침의 축을 중심으로 돌면서, 판의 바깥에서 안쪽으로 홈을 따라가요." },
  { n: "05", title: "Cartridge & stylus", label: "Stylus · 바늘", focus: ["Tonearm_Cartridge", "Tonearm_Stylus", "Tonearm_Headshell"], cam: { az: 80, el: 14, dist: 0.2 },
    body: "바늘이 홈의 흔들림을 읽고, 카트리지가 그 흔들림을 전기 신호로 바꿔요. 바늘은 닳는 소모품이라 제조사가 권하는 시간마다 갈아 줘요." },
  { n: "06", title: "Counterweight", label: "Counterweight · 침압", focus: ["Tonearm_Counterweight"], cam: { az: 150, el: 24, dist: 0.42 },
    body: "먼저 톤암이 수평으로 뜨게 균형을 맞추고, 눈금을 0에 둔 뒤 권장 침압만큼 돌려요. 너무 가벼우면 튀고, 너무 무거우면 판과 바늘이 닳아요. 권장값은 카트리지 설명서에 있어요(대개 1.5~2.5g)." },
  { n: "07", title: "Anti-skate", label: "Anti-skate", focus: ["Web_AntiSkate"], cam: { az: -35, el: 58, dist: 0.4 },
    body: "판이 돌면 톤암이 안쪽으로 끌려가는 힘이 생겨요. 안티스케이팅은 반대쪽으로 살짝 당겨 균형을 맞춰요. 보통 침압과 같은 숫자에서 시작해요." },
  { n: "08", title: "Cue lever", label: "Cue lever · 리프터", focus: ["Web_CueLever"], cam: { az: 48, el: 30, dist: 0.5 },
    body: "바늘을 천천히 내리고 올리는 장치예요. 손으로 내리다 판을 긁는 일을 막아 줘요." },
  { n: "09", title: "Arm rest & dust cover", label: "Dust cover · 덮개", focus: ["Turntable_DustCover", "Tonearm_ArmRest"], at: [0, 0.18, -0.02], cam: { az: 30, el: 18, dist: 1.05 },
    body: "다 들으면 톤암을 받침에 고정하고, 덮개로 먼지를 막아요. 재생 중에는 덮개를 열어 두기를 권하는 경우가 많아요." },
  { n: "10", title: "Drop the needle", at: [-0.02, 0.1, 0], cam: { az: 36, el: 38, dist: 0.8 },
    body: "이제 준비 끝. 판이 돌고, 톤암이 판 위에서 기다려요. 바늘을 내려 볼까요?" },
];

function Card(step) {
  return (
    <>
      <p className={`${LABEL} text-(--accent) tabular-nums`}>{step.n}</p>
      <h3 className={`${SERIF} mt-2 text-[clamp(1.7rem,2.6vw,2.4rem)] leading-[1]`}>{step.title}</h3>
      <p className="mt-3 break-keep text-[15px] leading-7 text-(--ink)/80">{step.body}</p>
      {step.link && <Link href={step.link[0]} className="mt-3 inline-block border-b border-current/30 text-[13px] text-(--ink)/70 hover:text-(--accent)">{step.link[1]}</Link>}
    </>
  );
}

export default function Story() {
  return (
    <>
      <section className={`${WRAP} pb-[clamp(2rem,5vw,4rem)] pt-[calc(var(--ct-header-h,106px)+56px)]`}>
        <Reveal as="p" className={`${LABEL} text-(--accent)`}>Vinyl A to Z · 04</Reveal>
        <RiseText as="h1" lines={["How a turntable", "works"]} delay={120} className={`${MONOTON} mt-5 text-[clamp(2.4rem,6vw,6rem)] leading-[1.04]`} />
        <Reveal delay={450} as="p" className="mt-7 max-w-[46ch] break-keep text-[clamp(1rem,1.4vw,1.2rem)] leading-8 text-(--ink)/80">
          판을 일정한 속도로 돌리고, 바늘이 홈을 따라가게 하는 기계. Grooves의 턴테이블로 부품을 하나씩 살펴봐요. 스크롤을 내리면 카메라가 따라가요.
        </Reveal>
      </section>

      <TurntableTour steps={STEPS} renderCard={Card} dropLabel="바늘 내리기" />

      <section className="border-y-[3px] border-(--ink) bg-(--ink) text-(--cream)">
        <div className={`${WRAP} grid gap-8 py-[clamp(3.5rem,8vw,6rem)] md:grid-cols-[1fr_auto] md:items-end`}>
          <div>
            <p className={`${LABEL} text-(--cream)/60`}>Next in Vinyl A to Z</p>
            <RiseText lines={["Storing &", "cleaning records"]} className={`${SERIF} mt-4 text-[clamp(2.4rem,5vw,4.8rem)] leading-[0.95]`} />
            <p className="mt-5 max-w-[46ch] break-keep text-[15px] leading-7 text-(--cream)/75">다음 편에서는 판을 오래 듣기 위한 보관과 청소를 다뤄요. 그동안 내 판들은 Grooves 컬렉션에 정리해 두세요.</p>
          </div>
          <Link href="/collection" className="inline-flex min-h-12 items-center gap-2 rounded-full bg-(--cream) px-8 text-[12px] font-medium uppercase tracking-[0.2em] text-(--ink) transition-colors hover:bg-(--accent) hover:text-(--cream)">Open Collection <span aria-hidden="true">→</span></Link>
        </div>
      </section>
      <p className={`${WRAP} pb-10 pt-8 text-center text-[11px] text-(--ink)/45`}>턴테이블 모델은 Grooves Home의 G-33이에요. 침압 · 안티스케이팅 값은 기기와 카트리지마다 다르니 설명서의 권장값을 따르세요.</p>
    </>
  );
}
