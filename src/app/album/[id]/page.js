"use client";
import { use } from "react";

import PageShell from "@/components/layout/PageShell";

export default function Album({ params }) {
  const { id } = use(params);

  return (
    <PageShell>
      <div className="album">
        <div className="album-cover" />
        <div className="album-info">
          <span className="page-label">LP · 2025</span>
          <h1 className="page-title">Album {id}</h1>
          <p className="page-desc">Artist — Label</p>
          <button type="button" className="home-cta">
            Add to collection
          </button>
        </div>
      </div>
    </PageShell>
  );
}
