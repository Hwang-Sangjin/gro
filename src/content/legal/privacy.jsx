// 개인정보처리방침 — 개인정보 보호법(대한민국) 필수 항목 순서에 맞춤
// 수집 항목이 바뀌면(새 기능·새 외부 서비스) 여기와 SITE.legalUpdated 를 같이 고칠 것
import Link from "next/link";
import { SITE } from "@/lib/site";

const mail = <a href={`mailto:${SITE.email}`}>{SITE.email}</a>;

function Table({ head, rows }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-(--ink)/20">
      <table className="w-full min-w-[520px] text-left text-[14px] leading-6">
        <thead className="bg-(--ink)/5 text-[11px] uppercase tracking-[0.18em] text-(--ink)/60">
          <tr>{head.map((h) => <th key={h} className="px-4 py-3 font-medium">{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-(--ink)/12 align-top">
              {r.map((c, j) => <td key={j} className={`px-4 py-3 ${j === 0 ? "font-medium text-(--ink)" : ""}`}>{c}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export const PRIVACY_INTRO = `${SITE.name} is a small, independent vinyl service. This policy explains what we collect, why, how long we keep it, and how to have it deleted. You can browse ${SITE.name} without an account; we only collect personal information when you sign in.`;

export const PRIVACY = [
  {
    id: "collect",
    title: "What we collect",
    body: (
      <>
        <p>We only collect what we need to run your account and the features you use.</p>
        <Table
          head={["When", "What", "Required?"]}
          rows={[
            ["Signing in with Google", "Email address, name, profile photo URL, and your Google account identifier", "Required to have an account"],
            ["Using your collection", "The records you mark as Owned or Wishlist, and when you added them", "Only if you use it"],
            ["Sharing your collection", "A public ID for your link (made from the part of your email before the @; you can change it) and whether sharing is on", "The ID is created with your account; sharing is off unless you turn it on"],
            ["Requesting a record", "What you type in the request form (album, artist, notes, release details, tracks, links) and any cover image you upload", "Only if you send a request"],
            ["Using the site", "A sign-in session cookie, your light/dark theme choice, and short-lived navigation state stored in your browser", "Needed for the site to work"],
            ["Every visit", "Standard server logs kept by our hosting providers (IP address, browser type, time of request)", "Collected automatically for security"],
          ]}
        />
        <p>We don’t use advertising trackers, sell data, or build marketing profiles.</p>
      </>
    ),
  },
  {
    id: "use",
    title: "How we use it",
    body: (
      <ul>
        <li>To sign you in and show your name and photo in the menu.</li>
        <li>To save and show your collection and wishlist.</li>
        <li>If you turn on sharing: to show your public ID and your Owned and Wishlist records to anyone with your link (collection/your-id). Your email, name and photo are never shown there, and you can turn sharing off at any time.</li>
        <li>To review your record requests, add records to the catalog, and show you each request’s status.</li>
        <li>To keep the service secure, prevent abuse, and fix problems.</li>
        <li>To meet legal obligations, if any apply.</li>
      </ul>
    ),
  },
  {
    id: "retention",
    title: "How long we keep it",
    body: (
      <>
        <p>We keep your information for as long as you have an account. When you delete your account, we delete your profile, collection, requests and any cover images you uploaded straight away.</p>
        <p>Copies may remain in our providers’ encrypted backups for a short time before they are overwritten. Server logs are kept by our hosting providers under their own retention schedules.</p>
        <p>If a record you requested was added to the catalog, the catalog entry (album details and cover) stays, but it is no longer linked to you.</p>
      </>
    ),
  },
  {
    id: "deletion",
    title: "Deleting your account",
    body: (
      <>
        <p>You can delete your account at any time from your <Link href="/account">Account</Link> page. Deletion is permanent and takes effect immediately. Deleted information is removed so that it cannot be restored.</p>
        <p>If you can’t sign in anymore, email {mail} from the address on your account and we’ll delete it for you.</p>
      </>
    ),
  },
  {
    id: "sharing",
    title: "Who we share it with",
    body: (
      <>
        <p>We don’t sell or rent your information, and we don’t give it to third parties for their own purposes. We use a few service providers to run {SITE.name}; they process data only on our behalf:</p>
        <Table
          head={["Provider", "What they do", "Data involved"]}
          rows={[
            ["Supabase, Inc.", "Database, sign-in and file storage, on servers in Seoul, Korea", "Account details, collection, requests, uploaded covers"],
            ["Vercel, Inc.", "Hosting and delivering the website, on servers in Seoul, Korea", "Server logs (IP address, browser type)"],
            ["Google LLC", "Google sign-in; the YouTube player on album pages", "Sign-in details; the YouTube player loads only after you press play"],
          ]}
        />
        <p>We may also disclose information if the law requires it.</p>
      </>
    ),
  },
  {
    id: "overseas",
    title: "Where it’s stored",
    body: (
      <>
        <p>Your account, collection, requests and uploaded covers are stored in <b>Korea</b> (Supabase, Seoul region), and the site runs on servers in Seoul (Vercel, Seoul region).</p>
        <p>A few things are processed outside Korea by the providers that deliver the site:</p>
        <Table
          head={["Recipient", "Country", "What and when", "Why · how long"]}
          rows={[
            ["Vercel, Inc.", "Its global delivery network (the location nearest you)", "IP address and browser type — when images, fonts and scripts are delivered, over an encrypted connection", "Delivering the site quickly · kept under Vercel’s log retention"],
            ["Google LLC", "United States", "Email, name and profile photo — when you sign in; IP address — when you press play on a YouTube player", "Sign-in and video playback · kept under Google’s privacy policy"],
          ]}
        />
        <p>If you don’t want your information to leave Korea, you can browse {SITE.name} without signing in and without playing videos. Features that need an account (collection, requests) won’t be available.</p>
      </>
    ),
  },
  {
    id: "rights",
    title: "Your rights",
    body: (
      <>
        <p>You can ask to see, correct, delete, or stop the processing of your personal information at any time. Many of these you can do yourself: your collection on the <Link href="/collection">Collection</Link> page, your account on the <Link href="/account">Account</Link> page. For anything else, email {mail} — we’ll respond within 10 days.</p>
        <p>Your name and photo come from your Google account; change them there and they’ll update the next time you sign in.</p>
      </>
    ),
  },
  {
    id: "cookies",
    title: "Cookies and local storage",
    body: (
      <>
        <p>We use only what the site needs to work:</p>
        <ul>
          <li><b>Sign-in cookies</b> keep you logged in.</li>
          <li><b>Local storage</b> remembers your light/dark theme and where you came from when opening an album.</li>
        </ul>
        <p>You can clear or block these in your browser settings. If you block cookies, you won’t be able to sign in.</p>
      </>
    ),
  },
  {
    id: "security",
    title: "How we protect it",
    body: (
      <ul>
        <li>All traffic is encrypted (HTTPS).</li>
        <li>Database rules make sure each person can only read their own collection and requests. A shared collection shows only your public ID and records.</li>
        <li>Only staff accounts can open the admin area, and server keys are never sent to your browser.</li>
      </ul>
    ),
  },
  {
    id: "children",
    title: "Children",
    body: <p>{SITE.name} is not meant for children under 14, and we don’t knowingly collect their information. If you believe a child under 14 has created an account, email {mail} and we’ll delete it.</p>,
  },
  {
    id: "contact",
    title: "Privacy contact",
    body: (
      <>
        <p>Person responsible for privacy: <b>{SITE.owner}</b>, operator of {SITE.name} — {mail}</p>
        <p>If you need further help, you can also contact:</p>
        <ul>
          <li>Personal Information Infringement Report Center (KISA) — privacy.kisa.or.kr, call 118</li>
          <li>Personal Information Dispute Mediation Committee — kopico.go.kr, call 1833-6972</li>
          <li>Supreme Prosecutors’ Office, Cyber Investigation — spo.go.kr, call 1301</li>
          <li>Korean National Police Agency, Cyber Bureau — ecrm.police.go.kr, call 182</li>
        </ul>
      </>
    ),
  },
  {
    id: "changes",
    title: "Changes to this policy",
    body: <p>If we change this policy, we’ll update the effective date above and announce significant changes on the site at least 7 days before they take effect.</p>,
  },
];
