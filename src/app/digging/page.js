import PageShell from "@/components/layout/PageShell";
import DiggingCatalog from "@/components/digging/DiggingCatalog";
import { createClient } from "@/utils/supabase/server";
import { fetchDiggingPage } from "@/lib/albums";
import styles from "@/components/digging/Digging.module.css";

export default async function Digging({ searchParams }) {
  const { genre = null } = await searchParams;
  const supabase = await createClient();
  let genreId = null;
  if (genre) {
    const { data } = await supabase.from("genres").select("id").eq("slug", genre).maybeSingle();
    genreId = data?.id ?? null;
  }
  const initial = await fetchDiggingPage(supabase, { genreId });
  return (
    <PageShell className={styles.page}>
      <DiggingCatalog key={genre ?? "all"} initial={initial} genreId={genreId} genre={genre} />
    </PageShell>
  );
}
