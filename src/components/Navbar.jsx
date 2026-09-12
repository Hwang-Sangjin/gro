"use client";

import Link from "next/link";

import { useIntro } from "./intro/intro-context";

const Navbar = () => {
  const { done } = useIntro();

  return (
    <nav
      className="navbar"
      data-ready={done ? "true" : "false"}
      style={{ viewTransitionName: "navbar" }}
    >
      <div className="navbar-logo">
        <div className="navbar-item">
          <Link href="/">Kaelon</Link>
        </div>
      </div>
      <div className="navbar-items">
        <div className="navbar-item">
          <Link href="/">Home</Link>
        </div>
        <div className="navbar-item">
          <Link href="/projects">Projects</Link>
        </div>
        <div className="navbar-item">
          <Link href="/info">Info</Link>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
