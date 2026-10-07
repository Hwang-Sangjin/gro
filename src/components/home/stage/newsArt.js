// News & Stories 카드 일러스트 (잉크 드로잉 톤 SVG). 기사마다 다른 장면이고, 카드에 마우스를 올리면 움직임.
// 실제 기사 이미지가 생기면 HomeStage의 POSTS에 image를 넣어 교체할 수 있음.
export const NEWS_ACCENT = '#c8553d';
const SPARKLE = 'M0-15C1.6-4 4-1.6 15 0 4 1.6 1.6 4 0 15-1.6 4-4 1.6-15 0-4-1.6-1.6-4 0-15Z';
// 판 하나: 연한 파랑 바탕 + 촘촘한 홈(잉크 선) + 빨간 라벨
function newsDisc(R, { label = NEWS_ACCENT, base = '#b9cce2', groove = '#7f9ec4' } = {}) {
  let rings = '';
  for (let r = R * 0.42; r < R - 2; r += 2.6 + (r % 7 > 5 ? 1.4 : 0)) {
    rings += `<circle r="${r.toFixed(1)}" fill="none" stroke="${groove}" stroke-width="${(0.35 + ((r * 13) % 5) / 10).toFixed(2)}" opacity="${(0.35 + ((r * 7) % 4) / 10).toFixed(2)}"/>`;
  }
  return `<circle r="${R}" fill="${base}"/>${rings}<circle r="${R - 0.6}" fill="none" stroke="${groove}" stroke-width="1.2"/>`
    + `<path d="M${-R * 0.92} ${-R * 0.2}A${R} ${R} 0 0 1 ${-R * 0.35} ${-R * 0.88}" stroke="#f4e7cd" stroke-width="${R * 0.07}" stroke-linecap="round" opacity=".35" fill="none"/>`
    + `<circle r="${R * 0.3}" fill="${label}"/><circle r="${R * 0.3 - 3}" fill="none" stroke="#f4e7cd" stroke-width=".5" opacity=".5"/><circle r="2.6" fill="#f4e7cd"/>`;
}
export const ART_T = 'transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] [transform-box:fill-box] origin-center';
// 먼지가 날아가는 방향 (Tailwind가 찾을 수 있게 클래스 문자열을 그대로 둠)
const DUST_FLY = [
  'group-hover:translate-x-[18px] group-hover:-translate-y-[10px]',
  'group-hover:translate-x-[24px] group-hover:-translate-y-[13px]',
  'group-hover:translate-x-[30px] group-hover:-translate-y-[16px]',
  'group-hover:translate-x-[36px] group-hover:-translate-y-[19px]',
  'group-hover:translate-x-[42px] group-hover:-translate-y-[22px]',
  'group-hover:translate-x-[48px] group-hover:-translate-y-[25px]',
];
export const NEWS_ART = {
  // 재발매: 슬리브에서 판이 미끄러져 나옴
  reissue: () => `
    <g transform="translate(200 150) rotate(-8)"><g class="${ART_T} group-hover:-translate-x-[6px]">
      <rect x="-92" y="-98" width="184" height="184" fill="#f4e7cd" stroke="#4c404a" stroke-opacity=".14"/>
      <path d="M-92 40 92 -60" stroke="#4c404a" stroke-opacity=".07"/><path d="M-92 70 92 -30" stroke="#4c404a" stroke-opacity=".05"/>
    </g></g>
    <g transform="translate(212 138)"><g class="${ART_T} group-hover:translate-x-[34px] group-hover:rotate-[50deg]">${newsDisc(66)}</g></g>
    <g transform="translate(98 104)"><path class="${ART_T} group-hover:rotate-90 group-hover:scale-125" d="${SPARKLE}" fill="${NEWS_ACCENT}"/></g>`,
  // 관리법: 판 위를 쓸고 지나가는 브러시 + 날아가는 먼지
  care: () => `
    <g transform="translate(184 150)"><g class="${ART_T} group-hover:rotate-[40deg]">${newsDisc(84)}</g></g>
    <g class="${ART_T} group-hover:translate-x-[-26px] group-hover:translate-y-[18px]" transform="translate(0 0)">
      <g transform="translate(258 92) rotate(-32)">
        <rect x="-58" y="-11" width="116" height="22" rx="11" fill="#4c404a"/>
        <rect x="-50" y="11" width="100" height="5" fill="#8a7f86"/>
        ${Array.from({ length: 24 }, (_, i) => `<path d="M${-48 + i * 4.2} 16v${12 + (i % 3) * 2}" stroke="#4f6d93" stroke-width="1.1"/>`).join('')}
      </g>
    </g>
    ${[[112, 96, 2.2], [132, 210, 1.6], [250, 200, 2], [226, 116, 1.4], [150, 70, 1.3], [282, 168, 1.8]].map(([x, y, r], i) =>
      `<circle cx="${x}" cy="${y}" r="${r}" fill="#4c404a" class="transition-[opacity,translate] duration-700 group-hover:opacity-0 ${DUST_FLY[i]}" opacity=".55"/>`).join('')}
    <g transform="translate(318 236)"><path class="${ART_T} group-hover:rotate-90" d="${SPARKLE}" transform="scale(.8)" fill="${NEWS_ACCENT}"/></g>`,
  // 새 소식: 부채꼴로 펼쳐지는 새 판들 + NEW PRESS 스티커
  press: () => `
    <g transform="translate(200 158)">
      <g class="${ART_T} group-hover:-rotate-[16deg] group-hover:-translate-x-[14px]"><g transform="rotate(-10)"><rect x="-80" y="-80" width="160" height="160" fill="#4f6d93"/><path d="M-80 30h160M-80 46h160" stroke="#f4e7cd" stroke-opacity=".25"/></g></g>
      <g class="${ART_T} group-hover:rotate-[10deg] group-hover:translate-x-[12px]"><g transform="rotate(6)"><rect x="-80" y="-80" width="160" height="160" fill="${NEWS_ACCENT}"/><circle r="38" cx="20" cy="-14" fill="#f2c14e" opacity=".9"/></g></g>
      <g transform="translate(0 -8)"><rect x="-80" y="-80" width="160" height="160" fill="#f4e7cd" stroke="#4c404a" stroke-opacity=".14"/>
        <g transform="translate(0 -6)" class="${ART_T} group-hover:-translate-y-[26px]"><g class="${ART_T} group-hover:rotate-[60deg]">${newsDisc(54)}</g></g>
        <text y="64" text-anchor="middle" font-family="Grooves Bodoni, Georgia, serif" font-size="11" font-weight="900" letter-spacing="2" fill="#4c404a">NEW PRESSING</text>
      </g>
      <g transform="translate(74 -78)"><g class="${ART_T} group-hover:rotate-[24deg] group-hover:scale-110">
        <circle r="26" fill="#f2c14e"/><circle r="22" fill="none" stroke="#4c404a" stroke-width=".6" stroke-dasharray="2 2"/>
        <text y="-1" text-anchor="middle" font-family="PP Neue Montreal, Arial, sans-serif" font-weight="900" font-size="11" fill="#4c404a">NEW</text>
        <text y="10" text-anchor="middle" font-family="PP Neue Montreal, Arial, sans-serif" font-size="6" letter-spacing="1" fill="#4c404a">2026</text>
      </g></g>
    </g>
    <g transform="translate(78 236)"><path class="${ART_T} group-hover:rotate-90" d="${SPARKLE}" transform="scale(.75)" fill="${NEWS_ACCENT}"/></g>`,
};
