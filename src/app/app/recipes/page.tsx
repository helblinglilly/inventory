import { RecipesPage } from "@/components/recipes-page";
import { requireServerInventoryAccess } from "@/lib/session";

export default async function RecipesRoute() {
  const { access } = await requireServerInventoryAccess();
  return <RecipesPage userId={access.inventoryUserId} />;
}
