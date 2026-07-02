import { PlacesPage } from "@/components/places-page";
import { requireServerInventoryAccess } from "@/lib/session";

export default async function PlacesRoute() {
  const { access } = await requireServerInventoryAccess();
  return <PlacesPage userId={access.inventoryUserId} />;
}
