import { RecipeDetailPage } from "@/components/recipe-detail-page";
import { requireServerInventoryAccess } from "@/lib/session";

export default async function RecipePage({
  params,
}: {
  params: Promise<{ recipeId: string }>;
}) {
  const { access } = await requireServerInventoryAccess();

  const { recipeId } = await params;

  return <RecipeDetailPage recipeId={recipeId} userId={access.inventoryUserId} />;
}
