import { PlannerPage } from "@/components/planner-page";
import { requireServerSession } from "@/lib/session";

export default async function PlannerRoute() {
  const session = await requireServerSession();
  return <PlannerPage userId={session.user.id} />;
}
