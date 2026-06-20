import { AddItemPage } from "@/components/add-item-page";
import { requireServerSession } from "@/lib/session";

export default async function AddRoute() {
  const session = await requireServerSession();
  return <AddItemPage userId={session.user.id} />;
}
