import { AdminHallWorkspace } from "../../../../../../../components/admin/admin-branch-workspace";

export default async function HallWorkspacePage({
  params,
}: {
  params: Promise<{ branchId: string; hallId: string }>;
}) {
  const { branchId, hallId } = await params;

  return <AdminHallWorkspace branchId={branchId} hallId={hallId} />;
}
