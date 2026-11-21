// 구조화 데이터(JSON-LD): 검색엔진이 페이지가 무엇인지(앨범 · 기사) 읽는 표. 화면에는 안 보임
import { SITE } from "./site";

// <script> 안에 넣을 문자열. "<" 를 바꿔 두지 않으면 제목에 </script> 가 들어 있을 때 태그가 닫힘
const toScript = (data) => JSON.stringify(data).replace(/</g, "\\u003c");

export function JsonLd({ data }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: toScript(data) }} />;
}

// 초 → ISO 8601 길이 (215 → "PT3M35S")
const isoDuration = (sec) => (sec > 0 ? `PT${Math.floor(sec / 60)}M${Math.round(sec % 60)}S` : undefined);

export function albumLd(a) {
  const url = `${SITE.url}/album/${a.slug}`;
  return {
    "@context": "https://schema.org", "@type": "MusicAlbum", "@id": url, url,
    name: a.title,
    ...(a.artistNames && { byArtist: { "@type": "MusicGroup", name: a.artistNames } }),
    ...(a.releaseYear && { datePublished: String(a.releaseYear) }),
    ...(a.coverUrl && { image: a.coverUrl }),
    ...(a.description && { description: a.description }),
    ...(a.tracks?.length && {
      numTracks: a.tracks.length,
      track: a.tracks.map((t, i) => ({ "@type": "MusicRecording", position: i + 1, name: t.title, ...(isoDuration(t.durationSec) && { duration: isoDuration(t.durationSec) }) })),
    }),
  };
}

export function storyLd(s) {
  const url = `${SITE.url}/news/${s.slug}`;
  const org = { "@type": "Organization", name: SITE.name, url: SITE.url };
  return {
    "@context": "https://schema.org", "@type": "Article", "@id": url, url, mainEntityOfPage: url,
    headline: s.title, description: s.dek, datePublished: s.date, inLanguage: "ko",
    image: `${SITE.url}/opengraph-image`,
    author: org, publisher: org,
  };
}
