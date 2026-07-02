import { RoomsPage } from "@/components/rooms-page";
import { requireServerInventoryAccess } from "@/lib/session";

export default async function RoomsRoute() {
  const { access } = await requireServerInventoryAccess();
  return <RoomsPage userId={access.inventoryUserId} />;
}
