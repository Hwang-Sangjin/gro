// 이용약관
import Link from "next/link";
import { SITE } from "@/lib/site";

const mail = <a href={`mailto:${SITE.email}`}>{SITE.email}</a>;

export const TERMS_INTRO = `These terms are the agreement between you and ${SITE.name} when you use the site. By signing in or using ${SITE.name}, you agree to them. We’ve kept them as short and plain as we can.`;

export const TERMS = [
  {
    id: "service",
    title: "What Grooves is",
    body: <p>{SITE.name} is a place to dig through records, keep track of the ones you own and want, request records we don’t have yet, and read stories about vinyl. It is run by {SITE.owner} in {SITE.city}, Korea. The service is free.</p>,
  },
  {
    id: "account",
    title: "Your account",
    body: (
      <ul>
        <li>You sign in with your Google account. You need to be at least 14 years old.</li>
        <li>Your account is for you alone. You’re responsible for what happens under it, so keep your Google account secure.</li>
        <li>You can delete your account at any time from the <Link href="/account">Account</Link> page.</li>
      </ul>
    ),
  },
  {
    id: "content",
    title: "What you send us",
    body: (
      <>
        <p>When you send a record request, including notes, links, track lists and cover images, you confirm that you have the right to share it.</p>
        <p>You let us use it to review the request and to add the record to the {SITE.name} catalog. This includes showing the cover and details to other people. Album artwork and recordings belong to their respective artists, labels and rights holders.</p>
        <p>We may edit, decline or remove requests at our discretion.</p>
      </>
    ),
  },
  {
    id: "rules",
    title: "Fair use of the service",
    body: (
      <>
        <p>Please don’t:</p>
        <ul>
          <li>upload anything illegal, hateful, sexually explicit, or that infringes someone else’s rights;</li>
          <li>send spam, or flood the request queue;</li>
          <li>try to access other people’s data or the admin area, or disrupt the service;</li>
          <li>scrape or copy the catalog in bulk, or resell it.</li>
        </ul>
        <p>If you break these rules, we may remove the content and suspend or delete the account.</p>
      </>
    ),
  },
  {
    id: "catalog",
    title: "Catalog and third-party content",
    body: (
      <>
        <p>Album information is provided for reference and may contain mistakes. If you spot one, tell us.</p>
        <p>Music on album pages plays through YouTube, under <a href="https://www.youtube.com/t/terms" target="_blank" rel="noreferrer">YouTube’s Terms of Service</a>.</p>
        <p>Links to other sites, such as shops, fairs and maps, are for convenience. We’re not responsible for their content.</p>
      </>
    ),
  },
  {
    id: "ours",
    title: "Our content",
    body: <p>The {SITE.name} name, design, illustrations, stories and code belong to {SITE.name}. You may share links and short quotes. Please don’t copy whole pages or designs without permission.</p>,
  },
  {
    id: "changes-service",
    title: "Changes and availability",
    body: <p>We’re a small project and we’ll keep improving {SITE.name}. That means features may change, pause or end. We’ll try to give notice of changes that affect your data. The service may sometimes be unavailable for maintenance or reasons outside our control.</p>,
  },
  {
    id: "liability",
    title: "Responsibility",
    body: (
      <>
        <p>{SITE.name} is provided free of charge and “as is”. We are not liable for damage caused by events beyond our reasonable control, by your misuse of the service, or by third-party services.</p>
        <p>Nothing in these terms limits liability that cannot be limited under Korean law, including liability for intentional misconduct or gross negligence.</p>
      </>
    ),
  },
  {
    id: "law",
    title: "Governing law",
    body: <p>These terms are governed by the laws of the Republic of Korea. Disputes will be handled by the competent court under the Civil Procedure Act of Korea.</p>,
  },
  {
    id: "updates",
    title: "Updates to these terms",
    body: <p>If we change these terms, we’ll update the effective date and announce the change on the site at least 7 days before it takes effect (30 days if it’s unfavourable to you). If you keep using {SITE.name} after that, you accept the new terms. If you don’t agree, you can delete your account.</p>,
  },
  {
    id: "contact",
    title: "Contact",
    body: <p>Questions about these terms or the service: {mail}. How we handle personal information is explained in our <Link href="/privacy">Privacy Policy</Link>.</p>,
  },
];
