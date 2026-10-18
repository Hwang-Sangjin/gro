// 관리자 화면 공통 스타일 (사이트 토큰을 그대로 써서 크림·브라운 테마 모두 맞음)
export const SERIF = "font-['Grooves_Display','Hahmlet',Georgia,serif] font-black tracking-[-0.008em]";
export const SANS = "font-['Hahmlet',Georgia,serif]";
export const field =
  "w-full rounded-xl border border-(--ink)/20 bg-(--cream) px-3.5 py-2.5 text-[14px] text-(--ink) outline-none transition-colors placeholder:text-(--ink)/35 focus:border-(--ink) disabled:opacity-60";
export const labelCls = "mb-1.5 block text-[11px] font-medium uppercase tracking-[0.2em] text-(--ink)/55";
export const btn =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 text-[12px] font-medium uppercase tracking-[0.16em] transition-colors disabled:cursor-not-allowed disabled:opacity-40";
export const btnPrimary = `${btn} bg-(--ink) text-(--cream) hover:bg-(--accent)`;
export const btnGhost = `${btn} border border-(--ink)/30 hover:border-(--ink) hover:bg-(--ink)/5`;
export const card = "rounded-2xl border border-(--ink)/12 bg-(--ink)/[0.03]";
