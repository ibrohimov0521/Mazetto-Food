import { AdminBranchDevices } from "../../../../../../components/admin/admin-branch-devices";

export default async function BranchDevicesPage({
  params,
}: {
  params: Promise<{ branchId: string }>;
}) {
  const { branchId } = await params;
  return <AdminBranchDevices branchId={branchId} />;
}
