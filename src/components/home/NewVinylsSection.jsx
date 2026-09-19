"use client";
import { useState } from "react";
import VinylShelf from "./VinylShelf";
import styles from "./NewVinylsSection.module.css";

const ITEMS = [
  { id: 1, title: "Soft Hours", artist: "Marian Vale", color: "#c4573a" },
  { id: 2, title: "Blue Notes", artist: "The Lanes", color: "#7fa3c7" },
  { id: 3, title: "After Sunset", artist: "Noa Hill", color: "#c4573a" },
  { id: 4, title: "Slow Motion", artist: "Kite & Co", color: "#4a6b8a" },
  { id: 5, title: "Midnight Tides", artist: "Aera", color: "#7fa3c7" },
  { id: 6, title: "Orbit Always", artist: "Pale Signal", color: "#2f3a4a" },
  { id: 7, title: "Quiet Places", artist: "Hallim", color: "#c4573a" },
];
export default function NewVinylsSection() {
  const [active, setActive] = useState(0);
  const item = ITEMS[active] ?? ITEMS[0];
  return (
    <section className={styles.section} aria-labelledby="new-vinyls-title">
      <header className={styles.heading}>
        <h2 id="new-vinyls-title" className={styles.title}>
          <span>New <svg viewBox="-16 -16 32 32" aria-hidden="true"><path d="M0-15C1.5-4 4-1.5 15 0 4 1.5 1.5 4 0 15-1.5 4-4 1.5-15 0-4-1.5-1.5-4 0-15Z" fill="currentColor" /></svg></span>
          <span>Vinyls</span>
        </h2>
      </header>
      <div className={styles.stage}><VinylShelf items={ITEMS} onActiveChange={setActive} /></div>
      <footer className={styles.footer}>
        <div aria-live="polite" aria-atomic="true">
          <span className={styles.counter}>{String(active + 1).padStart(2, "0")} / {String(ITEMS.length).padStart(2, "0")}</span>
          <strong className={styles.album}>{item.title}</strong>
          <span className={styles.artist}>{item.artist}</span>
        </div>
        <span className={styles.hint}>Drag to explore ↔</span>
      </footer>
    </section>
  );
}
