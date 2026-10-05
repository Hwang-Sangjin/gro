// The source record has radius 1, lies in XZ, and is 0.021497 units thick.
// Separate the screen-space roll from the record tilt for predictable art direction.
export const HERO_COMPOSITION = {
  tilt: (40 * Math.PI) / 180, // 32 → 40: 타원이 더 열림 (단축/장축 = sin 40° ≈ 0.64)
  roll: (33 * Math.PI) / 180, // -25 → +33: 장축이 오른쪽 위로, 테두리가 오른쪽 아래에 보임
  widthFraction: 0.74,
  compactWidthFraction: 0.9,
  heightFraction: 0.86, // 0.72 → 0.86: 목표 이미지 크기
};

export function getHeroRecordScale(width, height, pixelHeight) {
  const { tilt, roll, widthFraction, compactWidthFraction, heightFraction } =
    HERO_COMPOSITION;
  const shortAxis = Math.sin(tilt);
  const c = Math.cos(roll);
  const s = Math.sin(roll);
  // Projected ellipse bounds, including the edge thickness. Fit both axes so
  // wide, portrait, and short landscape screens never crop the record.
  const thickness = 0.021497 * Math.cos(tilt);
  const projectedWidth =
    2 * Math.hypot(c, shortAxis * s) + thickness * Math.abs(s);
  const projectedHeight =
    2 * Math.hypot(s, shortAxis * c) + thickness * Math.abs(c);
  const portraitBlend = Math.min(1, Math.max(0, (1.25 - width / height) / 0.5));
  const targetWidth =
    widthFraction + (compactWidthFraction - widthFraction) * portraitBlend;
  // The fixed navigation occupies the top 104px, also reserve that margin below
  // the centered model so short landscape screens keep the entire disc visible.
  const safeHeightFraction = Math.min(
    heightFraction,
    Math.max(0.1, 1 - 208 / pixelHeight),
  );
  return Math.min(
    (width * targetWidth) / projectedWidth,
    (height * safeHeightFraction) / projectedHeight,
  );
}
