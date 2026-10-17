// 공유 미리보기 이미지(next/og) 공용 도구 — 서버에서만
// - next/og 는 webp·avif 를 못 그림(앨범 커버는 webp) → sharp 로 jpeg 로 바꿔 data URL 로 넣음
// - Bodoni 는 라틴 글자만 있음 → 한글·일본어 제목이면 그 글자들만 Noto Serif KR 로 받아 덧붙임
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";

export const OG_SIZE = { width: 1200, height: 630 };
export const CREAM = "#f4e7cd", INK = "#4c404a", ACCENT = "#2d6a6a";

const font = (file) => readFile(join(process.cwd(), "src/assets/og", file));

/** 커버 주소 → jpeg data URL (못 받으면 null) */
export async function coverData(url, px = 640) {
  if (!url) return null;
  try {
    const res = await fetch(url, { next: { revalidate: 86400 } });
    if (!res.ok) return null;
    const buf = await sharp(Buffer.from(await res.arrayBuffer()))
      .resize(px, px, { fit: "cover" }).jpeg({ quality: 86 }).toBuffer();
    return `data:image/jpeg;base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

// 라틴·문장부호 밖의 글자가 있으면 그 글자들만 Noto Serif KR 로 (Google Fonts 의 text= 부분 글꼴)
async function fallbackFont(text, weight) {
  const chars = [...new Set([...text].filter((c) => c.codePointAt(0) > 0x24f && !/[ -⁯]/.test(c)))].join("");
  if (!chars) return null;
  try {
    const css = await (await fetch(`https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@${weight}&text=${encodeURIComponent(chars)}`)).text();
    const src = css.match(/src: url\((.+?)\) format\('(opentype|truetype|woff)'\)/)?.[1];
    return src ? await (await fetch(src)).arrayBuffer() : null;
  } catch {
    return null;
  }
}

/** ImageResponse 의 fonts — text: 그림에 들어가는 글자 전부 (한글 등이 있으면 대체 글꼴을 붙임) */
export async function ogFonts(text = "") {
  const [bold, regular, kBold, kRegular] = await Promise.all([
    font("bodoni-moda-latin-900-normal.woff"), font("bodoni-moda-latin-500-normal.woff"),
    fallbackFont(text, 900), fallbackFont(text, 500),
  ]);
  return [
    { name: "Bodoni", data: bold, weight: 900, style: "normal" },
    { name: "Bodoni", data: regular, weight: 500, style: "normal" },
    ...(kBold ? [{ name: "Noto Serif KR", data: kBold, weight: 900, style: "normal" }] : []),
    ...(kRegular ? [{ name: "Noto Serif KR", data: kRegular, weight: 500, style: "normal" }] : []),
  ];
}
export const OG_FAMILY = "Bodoni, 'Noto Serif KR'";

/** 배경색 위에 올릴 글자색 (밝은 색이면 잉크, 어두우면 크림) */
export function inkOn(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || "");
  if (!m) return INK;
  const n = parseInt(m[1], 16), c = [n >> 16, (n >> 8) & 255, n & 255].map((v) => {
    v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2] > 0.36 ? INK : CREAM;
}

/** 레코드 판 (홈·앨범 공용): 홈이 파인 검은 판 + 가운데 라벨 */
export function Disc({ size, label = ACCENT, style }) {
  return (
    <div style={{
      position: "absolute", display: "flex", alignItems: "center", justifyContent: "center",
      width: size, height: size, borderRadius: size,
      backgroundImage: "repeating-radial-gradient(circle at center, #1d191b 0px, #1d191b 3px, #2c2629 4px, #1d191b 6px)",
      boxShadow: "0 20px 44px rgba(30,24,28,0.35)", ...style,
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: size * 0.34, height: size * 0.34, borderRadius: size, background: label }}>
        <div style={{ display: "flex", width: size * 0.03, height: size * 0.03, borderRadius: size, background: "#1d191b" }} />
      </div>
    </div>
  );
}
