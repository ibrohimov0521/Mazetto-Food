import { AdminTableWorkspace } from "../../../../../../../../../components/admin/admin-branch-workspace";

export default async function TableWorkspacePage({
  params,
}: {
  params: Promise<{ branchId: string; hallId: string; tableId: string }>;
}) {
  const { branchId, hallId, tableId } = await params;

  return (
    <AdminTableWorkspace
      branchId={branchId}
      hallId={hallId}
      tableId={tableId}
    />
  );
}
