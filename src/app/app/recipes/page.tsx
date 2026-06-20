import { RecipesPage } from "@/components/recipes-page";
import { requireServerSession } from "@/lib/session";

export default async function RecipesRoute() {
  const session = await requireServerSession();
  return <RecipesPage userId={session.user.id} />;
}
