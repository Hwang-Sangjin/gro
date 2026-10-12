// /admin/requests — 사용자 앨범 요청: 대기 / 등록됨 / 반려
import { listRequests } from "@/lib/admin/data";
import { AdminHeader } from "@/components/admin/AdminShell";
import RequestTable from "@/components/admin/RequestTable";

export const dynamic = "force-dynamic";

export default async function AdminRequests() {
  const requests = await listRequests();
  const pending = requests.filter((r) => r.status === "pending").length;
  return (
    <>
      <AdminHeader eyebrow={`${pending} waiting`} title="Requests" />
      <RequestTable requests={requests} />
    </>
  );
}
