import { InventoryWorkspace } from "@/components/inventory-workspace";
import { requireServerSession } from "@/lib/session";

export default async function AppPage() {
  await requireServerSession();
  return <InventoryWorkspace />;
}
