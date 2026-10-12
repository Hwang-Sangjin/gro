// /admin/* — 로그인 + 관리자(profiles.role = admin)만
// 로그인 안 했으면 로그인 페이지로, 관리자가 아니면 안내 화면
import { redirect } from "next/navigation";
import Link from "next/link";
import { getAdmin } from "@/lib/admin/auth";
import { pendingRequestCount } from "@/lib/admin/data";
import AdminShell from "@/components/admin/AdminShell";
import { SERIF, btnGhost } from "@/components/admin/ui";

export const metadata = { title: "Admin · Grooves", robots: { index: false } };

export default async function AdminLayout({ children }) {
  const { user, admin } = await getAdmin();
  if (!user) redirect("/login?next=/admin");
  if (!admin) {
    return (
      <div data-lenis-prevent className="fixed inset-0 z-[1000] grid place-items-center bg-(--cream) px-6 text-center text-(--ink)">
        <div className="max-w-md">
          <p className="text-[11px] font-medium uppercase tracking-[0.3em] opacity-55">403 · Admin</p>
          <h1 className={`${SERIF} mt-3 text-[clamp(36px,5vw,56px)] leading-none`}>Staff only</h1>
          <p className="mt-4 text-[14px] leading-6 opacity-70">
            {user.email} is not an admin account.<br />Ask an admin to grant access in Supabase.
          </p>
          <Link href="/" className={`${btnGhost} mt-8`}>Back to site</Link>
        </div>
      </div>
    );
  }
  const pending = await pendingRequestCount().catch(() => 0);   // 메뉴의 Requests 옆 숫자
  return <AdminShell email={user.email} pending={pending}>{children}</AdminShell>;
}
