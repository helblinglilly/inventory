import { AddItemPage } from "@/components/add-item-page";
import { requireServerInventoryAccess } from "@/lib/session";

export default async function AddRoute() {
  const { access } = await requireServerInventoryAccess();
  return <AddItemPage userId={access.inventoryUserId} />;
}
