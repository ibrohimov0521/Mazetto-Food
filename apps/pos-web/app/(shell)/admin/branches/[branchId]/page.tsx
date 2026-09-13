import { AdminBranchWorkspace } from "../../../../../components/admin/admin-branch-workspace";

export default async function BranchWorkspacePage({
  params,
}: {
  params: Promise<{ branchId: string }>;
}) {
  const { branchId } = await params;

  return <AdminBranchWorkspace branchId={branchId} />;
}
