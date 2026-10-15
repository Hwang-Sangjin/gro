// 관리자에서 앨범을 고치면, 미리 만들어 둔(캐시된) 앨범 상세·Digging 첫 화면을 바로 새로 만들게 함
import { revalidatePath } from "next/cache";

export function revalidateAlbum(slug?: string | null) {
  try {
    if (slug) revalidatePath(`/album/${encodeURIComponent(slug)}`);
    revalidatePath("/digging");
    revalidatePath("/sitemap.xml");
  } catch {}
}
