"use client";
// 관리자 화면 틀: 왼쪽 메뉴 + 오른쪽 내용 (모바일은 위쪽 가로 메뉴)
// 사이트 헤더·페이지 넘김 위를 덮는 전체 화면. 스크롤은 이 안에서만
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SERIF, SANS } from "./ui";
import { useTheme, toggleTheme } from "@/lib/theme";

const NAV = [
  { href: "/admin", label: "Dashboard", exact: true },
  { href: "/admin/albums", label: "Albums", match: (p) => p === "/admin/albums" || (/^\/admin\/albums\/[^/]+$/.test(p) && !p.endsWith("/new") && !p.endsWith("/cover")) },
  { href: "/admin/albums/new", label: "New album" },
  { href: "/admin/albums/cover", label: "Replace cover" },
  { href: "/admin/requests", label: "Requests", badge: true },
];
const SOON = ["News"];   // 다음 단계에서 열림

export default function AdminShell({ email, pending = 0, children }) {
  const path = usePathname();
  const dark = useTheme() === "dark";
  const active = (item) => (item.match ? item.match(path) : item.exact ? path === item.href : path.startsWith(item.href));
  return (
    <div data-lenis-prevent data-crate-ignore className={`fixed inset-0 z-[1000] overflow-y-auto bg-(--cream) text-(--ink) ${SANS}`}>
      <div className="mx-auto grid min-h-full max-w-[1400px] grid-cols-[minmax(0,1fr)] md:grid-cols-[232px_minmax(0,1fr)]">
        <aside className="min-w-0 border-b border-(--ink)/12 px-5 py-5 md:sticky md:top-0 md:flex md:h-svh md:flex-col md:border-b-0 md:border-r md:px-6 md:py-8">
          <div className="flex items-baseline justify-between gap-3 md:block">
            <Link href="/" data-crate-skip className={`${SERIF} text-[26px] leading-none`}>Grooves</Link>
            <p className="text-[10px] font-medium uppercase tracking-[0.3em] text-(--ink)/50 md:mt-2">Admin</p>
          </div>
          <nav aria-label="Admin" className="-mx-1 mt-4 flex gap-1 overflow-x-auto [scrollbar-width:none] md:mx-0 md:mt-10 md:flex-col md:overflow-visible">
            {NAV.map((item) => (
              <Link key={item.href} href={item.href} aria-current={active(item) ? "page" : undefined}
                className="shrink-0 rounded-full px-3.5 py-2 text-[13px] tracking-[0.02em] text-(--ink)/65 transition-colors hover:bg-(--ink)/6 hover:text-(--ink) aria-[current=page]:bg-(--ink) aria-[current=page]:text-(--cream)">
                {item.label}
                {item.badge && pending > 0 && <span className="ml-2 inline-grid min-w-5 place-items-center rounded-full bg-(--accent) px-1.5 text-[10px] font-semibold tabular-nums text-(--cream)">{pending}</span>}
              </Link>
            ))}
            {SOON.map((label) => (
              <span key={label} className="flex shrink-0 items-center gap-2 px-3.5 py-2 text-[13px] text-(--ink)/30">
                {label}<span className="rounded-full border border-current px-1.5 text-[9px] uppercase tracking-[0.15em]">Soon</span>
              </span>
            ))}
          </nav>
          <div className="mt-auto hidden pt-8 text-[12px] text-(--ink)/55 md:block">
            <p className="truncate">{email}</p>
            <Link href="/" className="mt-2 inline-block underline-offset-4 hover:text-(--ink) hover:underline">← Back to site</Link>
            <button type="button" onClick={(e) => toggleTheme(e.currentTarget)} aria-pressed={dark}
              className="mt-4 flex items-center gap-2 rounded-full border border-(--ink)/20 px-3 py-1.5 text-[11px] uppercase tracking-[0.14em] hover:border-(--ink)">
              <span aria-hidden="true" className="size-3 rounded-full border border-current bg-[linear-gradient(90deg,currentColor_50%,transparent_50%)]" />
              {dark ? "Light mode" : "Dark mode"}
            </button>
          </div>
        </aside>
        <main className="min-w-0 px-5 py-8 md:px-12 md:py-12">{children}</main>
      </div>
    </div>
  );
}

// 각 화면 맨 위 제목 줄
export function AdminHeader({ eyebrow, title, children }) {
  return (
    <header className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b-[3px] border-(--ink) pb-5">
      <div>
        {eyebrow && <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-(--ink)/55">{eyebrow}</p>}
        <h1 className={`${SERIF} mt-2 text-[clamp(34px,4.4vw,56px)] leading-none`}>{title}</h1>
      </div>
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
    </header>
  );
}
