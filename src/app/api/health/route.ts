import { createClient } from "@/utils/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("digging_page", { p_limit: 5 });

  return Response.json({ ok: !error, count: data?.length ?? 0, error });
}
