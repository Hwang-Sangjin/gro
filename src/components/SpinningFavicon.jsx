"use client";
// 브라우저 탭의 아이콘(파비콘)이 턴테이블 위 판처럼 계속 돌아감
// - 브라우저는 움직이는 파비콘을 지원하지 않아서(Chrome 은 GIF 도 멈춤), 돌린 그림 24장을 미리 그려 두고 번갈아 끼움
// - 33⅓ rpm 에 맞춰 한 바퀴 1.8초. 다른 탭을 보고 있을 땐 브라우저가 타이머를 늦춰서 천천히 똑딱이며 돎
// - 움직임 줄이기 설정이면 돌리지 않음. 정지 아이콘은 app/favicon.ico (JS 없이도 보임)
// - 첫 로딩 인트로(가운데 판이 새겨지고 파고드는 연출)가 다 끝난 뒤 한가할 때 시작 → 인트로가 버벅이지 않게
import { useEffect } from "react";
import { useIntro } from "./intro/intro-context";

const FRAMES = 24;
const REV_MS = 1800;            // 33⅓ rpm
const SRC = "/images/grooves/favicon-badge.png";

function iconLink() {
  return document.querySelector('link[rel~="icon"][href*="favicon"]') || document.querySelector('link[rel~="icon"]');
}

export default function SpinningFavicon() {
  const { done } = useIntro();
  useEffect(() => {
    if (!done || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let timer = 0, alive = true, link = null, original = null, idle = 0, wait = 0;
    const image = new Image();
    image.onload = () => {
      if (!alive) return;
      const size = 64, canvas = document.createElement("canvas");
      canvas.width = canvas.height = size;
      const ctx = canvas.getContext("2d");
      const frames = Array.from({ length: FRAMES }, (_, i) => {
        ctx.clearRect(0, 0, size, size);
        ctx.save();
        ctx.translate(size / 2, size / 2);
        ctx.rotate((i / FRAMES) * Math.PI * 2);     // 시계 방향
        ctx.drawImage(image, -size / 2, -size / 2, size, size);
        ctx.restore();
        return canvas.toDataURL("image/png");
      });
      let i = 0;
      timer = setInterval(() => {
        if (!link?.isConnected) {                  // 페이지 이동 중 <head> 가 바뀌어도 다시 찾음
          link = iconLink();
          if (!link) return;
          original = link.getAttribute("href");
          link.removeAttribute("sizes");           // sizes="any" 그대로면 일부 브라우저가 바뀐 그림을 무시
          link.type = "image/png";
        }
        link.href = frames[i = (i + 1) % FRAMES];
      }, REV_MS / FRAMES);
    };
    // 인트로의 마지막 페이드가 끝나고, 브라우저가 한가할 때 그림을 그림
    const later = window.requestIdleCallback ?? ((fn) => setTimeout(fn, 200));
    wait = setTimeout(() => { idle = later(() => { image.src = SRC; }); }, 1200);
    return () => {
      alive = false;
      clearTimeout(wait);
      if (idle) (window.cancelIdleCallback ?? clearTimeout)(idle);
      clearInterval(timer);
      if (link && original) link.href = original;
    };
  }, [done]);
  return null;
}
