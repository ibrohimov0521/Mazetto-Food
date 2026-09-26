import { OwnerConsole } from "../../../components/owner-console";

export default async function RestaurantPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <OwnerConsole view="detail" siteId={id} />;
}
