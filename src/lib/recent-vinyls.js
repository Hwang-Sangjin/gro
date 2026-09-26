// Home uses upload order; Digging keeps its release-date cursor ordering.
export const RECENT_VINYL_LIMIT = 7;

export async function fetchRecentVinyls(supabase, signal) {
  let query = supabase
    .from("albums")
    .select("id, slug, title, artist_names, cover_path, thumb_path, cover_color, created_at")
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(RECENT_VINYL_LIMIT);
  if (signal) query = query.abortSignal(signal);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}
