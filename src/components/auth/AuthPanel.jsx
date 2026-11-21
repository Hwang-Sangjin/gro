"use client";
/* 로그인 — 레코드 가게의 회원 카드 (2026-11-22 다시 만듦. 예전: 판이 돌고 라벨이 버튼인 턴테이블)
   Digging 의 칸막이 · Collection 의 메모 판지와 같은 물건(크래프트 판지 · 다이모 라벨 · 고무 도장 · 마커 손글씨)으로 만든 카드 한 장.
   - 카드 오른쪽 아래 "도장 자리"가 곧 "Continue with Google" 버튼. 누르면 도장이 쿵 찍힌 뒤 Google 로그인으로 이동 (처음이면 그 자리에서 계정이 만들어짐)
   - 카드 뒤에는 상자에 꽂힌 재킷 몇 장: 로그인 전에는 새로 들어온 판, 로그인하면 내 판
   - 로그인한 상태면 카드가 채워져 있음: 이름(손글씨) · 가입한 달 · 내 판 수 · 프로필 사진 · 찍힌 도장 → My collection / Log out
   ?next=/collection 처럼 넘어오면 로그인 후 그 페이지로 돌아감. ?error= 가 있으면 실패 안내
   모양은 Auth.module.css (카드 폭 기준 크기) */
import { MONOTON } from "@/lib/fonts";
import { useEffect, useState } from "react";
import Link from "next/link";
import "@fontsource/permanent-marker/400.css";
import PageShell from "@/components/layout/PageShell";
import useAuthUser, { authClient, profileOf, signInWithGoogle, signOut } from "@/lib/useAuthUser";
import { fetchShelves } from "@/lib/userAlbums";
import { coverUrl } from "@/lib/albums";
import styles from "./Auth.module.css";

const STAMP_MS = 750;        // 도장이 찍히는 시간 → 그다음 Google 로 이동
const TILT = [-7, 4, -3, 6]; // 카드 뒤 재킷들의 기울기(도)
const monthOf = (d) => { const t = d ? new Date(d) : new Date(); return `${String(t.getMonth() + 1).padStart(2, "0")}.${t.getFullYear()}`; };
// 회원 번호: 계정 id 에서 뽑은 네 자리 (늘 같은 번호)
const memberNo = (id = "") => { let h = 2166136261; for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619); return String((h >>> 0) % 9000 + 1000); };

function GoogleMark({ className = "" }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 48 48" className={className}>
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

export default function AuthPanel() {
  const user = useAuthUser();                 // undefined = 확인 중
  const [next, setNext] = useState("/");
  const [error, setError] = useState(false);
  const [phase, setPhase] = useState("idle"); // idle → stamping(도장 찍는 중) → Google / done(로그인됨)
  const [hover, setHover] = useState(false);
  const [crate, setCrate] = useState([]);     // 로그인 전: 새로 들어온 판 몇 장
  const [shelf, setShelf] = useState(null);   // 로그인 후: { owned, wishlist }

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const n = q.get("next");
    if (n && n.startsWith("/") && !n.startsWith("//")) setNext(n);
    if (q.get("error")) setError(true);
  }, []);

  // 카드 뒤에 꽂을 재킷: 새로 들어온 판 네 장 (못 받으면 빈 채로 — 카드만 보임)
  useEffect(() => {
    let alive = true;
    authClient().from("albums").select("slug, thumb_path, cover_color").eq("status", "published").order("created_at", { ascending: false }).limit(4)
      .then(({ data }) => { if (alive && data) setCrate(data); }, () => {});
    return () => { alive = false; };
  }, []);
  // 로그인했으면 내 판 (수 · 재킷)
  useEffect(() => {
    if (!user) { setShelf(null); return; }
    let alive = true;
    fetchShelves().then((s) => { if (alive) setShelf(s); }, () => {});
    return () => { alive = false; };
  }, [user]);

  const state = user ? "done" : phase;
  const p = profileOf(user);
  const first = p.name ? p.name.split(" ")[0] : "";
  const mine = shelf ? [...shelf.owned, ...shelf.wishlist].slice(0, 4) : [];
  const covers = state === "done" && mine.length ? mine : crate;
  const dest = next !== "/" ? next : "/collection";

  function stamp() {
    if (state !== "idle" || user === undefined) return;
    setPhase("stamping"); setError(false);
    const wait = matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : STAMP_MS;
    setTimeout(async () => {
      const { error: e } = await signInWithGoogle(next);   // 성공하면 Google 화면으로 넘어감
      if (e) { setError(true); setPhase("idle"); }
    }, wait);
  }

  const status = error ? "Couldn’t finish signing in. Stamp the card to try again."
    : state === "stamping" ? "Stamped — heading to Google…"
    : state === "done" ? p.email
    : "Stamp the card to log in";
  const shelfText = !shelf ? "…" : `${shelf.owned.length} record${shelf.owned.length === 1 ? "" : "s"}${shelf.wishlist.length ? ` · ${shelf.wishlist.length} wished` : ""}`;
  const lift = { onPointerEnter: () => setHover(true), onPointerLeave: () => setHover(false), onFocus: () => setHover(true), onBlur: () => setHover(false) };

  return (
    <PageShell className="paper-textured [&>.page-content]:gap-0! [&>.page-content]:p-0!" footer={false}>
      <section className="flex min-h-svh w-full overflow-x-clip flex-col items-center justify-center gap-[clamp(12px,2.2svh,26px)] px-5 pb-[clamp(20px,4svh,44px)] pt-[calc(var(--ct-header-h,106px)+clamp(4px,1.5svh,20px))] text-center font-['Hahmlet',Georgia,serif] text-(--ink)">
        <p className="text-[11px] font-medium uppercase tracking-[0.3em] opacity-60">Login</p>
        <h1 className={`${MONOTON} -mt-1 text-[clamp(30px,min(4.4vw,6.4svh),56px)] leading-[1.1]`}>
          {state === "done" ? <>Welcome back{first ? <>, <span className="whitespace-nowrap">{first}</span></> : ""}</> : "Join the club"}
        </h1>

        {/* 상자에 꽂힌 회원 카드 */}
        <div className={styles.deck} data-state={state} data-hover={hover && state !== "stamping"}>
          <div className={styles.stack}>
            <div aria-hidden="true" className={styles.covers}>
              {covers.map((a, i) => (
                <span key={a.slug} data-on="true" style={{ "--i": i, "--r": `${TILT[i % TILT.length]}deg`, backgroundColor: a.cover_color || "#bbcbda" }}>
                  {a.thumb_path && <img src={coverUrl(a.thumb_path)} alt="" loading="lazy" decoding="async" />}
                </span>
              ))}
            </div>

            <div className={styles.card}>
              <span aria-hidden="true" className={styles.tab}><span className={styles.dymo}>Member card</span></span>
              <div className={styles.face}>
                <span aria-hidden="true" className={styles.club}>Grooves<br />Record club</span>
                <span aria-hidden="true" className={styles.photo} data-filled={state === "done" && !!p.avatar}>
                  {state === "done" && p.avatar ? <img src={p.avatar} alt="" referrerPolicy="no-referrer" /> : "Photo"}
                </span>

                {/* 적는 줄: 로그인 전에는 연필로 적힌 안내, 로그인하면 마커 손글씨 */}
                <dl className={styles.rows}>
                  <div><dt>Name</dt>{state === "done" ? <dd>{first || "Digger"}</dd> : <dd data-pencil="true">filled in by Google</dd>}</div>
                  <div><dt>Since</dt>{state === "done" ? <dd>{monthOf(user.created_at)}</dd> : <dd data-pencil="true">today</dd>}</div>
                  <div><dt>{state === "done" ? `No. ${memberNo(user.id)}` : "Shelf"}</dt>{state === "done" ? <dd>{shelfText}</dd> : <dd data-pencil="true">set up automatically</dd>}</div>
                </dl>
                <p aria-hidden="true" className={styles.fine}>Admits one digger · Non-transferable</p>

                {/* 도장 자리 = 로그인 버튼 (로그인 상태면 찍힌 도장 → 내 컬렉션으로) */}
                {state === "done" ? (
                  <Link href={dest} aria-label="Open my collection" className={styles.seal} {...lift}>
                    <span className={styles.inked}>Member<small>Valid · {monthOf(user.created_at)}</small></span>
                  </Link>
                ) : (
                  <button type="button" onClick={stamp} disabled={user === undefined} aria-label="Continue with Google" className={styles.seal} {...lift}>
                    <span className={styles.sealBody}>
                      <span className={styles.sealG}><GoogleMark className="size-[58%]" /></span>
                      <span className={styles.sealText}>Continue with Google</span>
                      <span className={styles.sealHint}>Stamp here</span>
                    </span>
                    {state === "stamping" && <span className={styles.inked}>Member<small>Valid · {monthOf()}</small></span>}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        <p role="status" className={`min-h-[1.6em] text-[14px] tracking-[0.02em] ${error ? "text-(--danger)" : "opacity-80"}`}>{user === undefined ? "" : status}</p>

        {state === "done" ? (
          <div className="flex flex-wrap justify-center gap-2.5">
            <Link href={dest} className="inline-flex min-h-12 items-center rounded-full bg-(--ink) px-7 text-[12px] font-medium uppercase tracking-[0.18em] text-(--cream) transition-colors hover:bg-(--accent)">
              {next !== "/" ? "Continue" : "My collection"}
            </Link>
            <button type="button" onClick={() => { setPhase("idle"); signOut(); }}
              className="inline-flex min-h-12 items-center rounded-full border border-(--ink) px-7 text-[12px] font-medium uppercase tracking-[0.18em] transition-colors hover:bg-(--ink) hover:text-(--cream)">
              Log out
            </button>
          </div>
        ) : (
          <p className="max-w-[58ch] text-balance text-[12px] leading-[1.75] opacity-65">
            First time here? Your card and shelf are set up automatically.<br className="max-sm:hidden" /> We only receive your name, email and profile photo.<br className="max-sm:hidden" />{" "}
            By continuing you agree to our <Link href="/terms" className="relative underline underline-offset-4 before:absolute before:-inset-x-1 before:-inset-y-3.5 before:content-[''] hover:opacity-100">Terms</Link> and <Link href="/privacy" className="relative whitespace-nowrap underline underline-offset-4 before:absolute before:-inset-x-1 before:-inset-y-3.5 before:content-[''] hover:opacity-100">Privacy Policy</Link>.
          </p>
        )}
      </section>
    </PageShell>
  );
}
