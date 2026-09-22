export const GENRES = [
  {
    slug: "k-indie",
    name: "K-indie",
    covers: ["k-indie-1", "k-indie-2", "k-indie-3"],
  },
  { slug: "indie", name: "Indie", covers: ["indie-1", "indie-2", "indie-3"] },
  { slug: "pop", name: "Pop", covers: ["pop-1", "pop-2", "pop-3"] },
  { slug: "rock", name: "Rock", covers: ["rock-1", "rock-2", "rock-3"] },
  { slug: "folk", name: "Folk", covers: ["folk-1", "folk-2", "folk-3"] },
  { slug: "soul", name: "R&B/Soul", covers: ["soul-1", "soul-2", "soul-3"] },
  { slug: "jazz", name: "Jazz", covers: ["jazz-1", "jazz-2", "jazz-3"] },
  {
    slug: "city-pop",
    name: "City Pop",
    covers: ["citypop-1", "citypop-2", "citypop-3"],
  },
  {
    slug: "hip-hop",
    name: "Hip-hop",
    covers: ["hiphop-1", "hiphop-2", "hiphop-3"],
  },
  {
    slug: "classical",
    name: "Classical",
    covers: ["classical-1", "classical-2", "classical-3"],
  },
  { slug: "ost", name: "OST", covers: ["ost-1", "ost-2", "ost-3"] },
  { slug: "etc", name: "기타", covers: ["etc-1", "etc-2", "etc-3"] },
];

export const GENRE_BY_SLUG = Object.fromEntries(GENRES.map((g) => [g.slug, g]));
export const getGenreName = (slug) => GENRE_BY_SLUG[slug]?.name ?? slug;
