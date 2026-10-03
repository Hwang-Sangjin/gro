"use client";
import { useEffect, useRef, useState } from "react";
import "./HomeDecoration.css";
import DoodleSprite from "../doodle/DoodleSprite";

/** Decorative GIFs stay outside the reading column and never capture input. */
export default function HomeDecoration({ name, side = "left", layout = "wide", top = "56%", visible = true, reveal = "scroll", delay = 600, elementRef, captionRef }) {
  const localRef = useRef(null);
  const pictureRef = localRef;
  const captions = {
    "vinyl-disk": "Slow down. Listen closer.",
    "vinyl-albums": "Your next favorite awaits.",
    gramophone: "Follow your mood.",
    "vinyl-player": "Beyond the grooves.",
  };
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    if (reveal !== "scroll" || !visible || revealed) return;
    const section = pictureRef.current?.closest("section");
    if (!section) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    let timer;
    const observer = new IntersectionObserver(([entry]) => {
      window.clearTimeout(timer);
      if (!entry.isIntersecting) return;
      timer = window.setTimeout(() => {
        setRevealed(true);
        observer.disconnect();
      }, reduced.matches ? 0 : delay);
    }, { root: section.closest(".page"), rootMargin: "0px 0px -15% 0px", threshold: 0 });
    observer.observe(section);
    return () => {
      window.clearTimeout(timer);
      observer.disconnect();
    };
  }, [delay, reveal, revealed, visible]);

  return (
    <figure ref={pictureRef} data-reveal={reveal} data-revealed={revealed ? "true" : "false"}
      className={`grooves-home-decoration grooves-home-${side} grooves-home-${layout}`}
      style={{ "--decor-top": top }} hidden={!visible}>
      <picture ref={elementRef} className="grooves-home-decoration-art" aria-hidden="true">
        <DoodleSprite id={{"vinyl-disk":"01","vinyl-albums":"02","vinyl-player":"03",gramophone:"04"}[name] || "01"} />
      </picture>
      <figcaption className="grooves-home-decoration-caption">
        <span ref={captionRef}>{captions[name]}</span>
      </figcaption>
    </figure>
  );
}
