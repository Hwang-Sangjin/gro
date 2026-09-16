"use client";
import Link from "next/link";

import { useIntro } from "@/components/intro/intro-context";

const NAV = [
  { href: "/digging", label: "Digging" },
  { href: "/collection", label: "Collection" },
  { href: "/news", label: "News" },
];

export default function Navbar() {
  const { done } = useIntro();

  return (
    <nav
      className="navbar"
      data-ready={done ? "true" : "false"}
      style={{ viewTransitionName: "navbar" }}
    >
      <Link className="navbar-mark" href="/">
        Grooves
      </Link>

      <div className="navbar-items">
        {NAV.map((item) => (
          <div className="navbar-item" key={item.href}>
            <Link href={item.href}>{item.label}</Link>
          </div>
        ))}
        <div className="navbar-item">
          <Link href="/login">Login</Link>
        </div>
      </div>
    </nav>
  );
}
