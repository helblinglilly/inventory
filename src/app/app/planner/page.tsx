import { PlannerPage } from "@/components/planner-page";
import { requireServerInventoryAccess } from "@/lib/session";

export default async function PlannerRoute() {
  const { access } = await requireServerInventoryAccess();
  return <PlannerPage userId={access.inventoryUserId} />;
}
