import { ShoppingPrepPage } from "@/components/shopping-prep-page";
import { requireServerInventoryAccess } from "@/lib/session";

export default async function ShoppingPrepRoute() {
  await requireServerInventoryAccess();
  return <ShoppingPrepPage />;
}
