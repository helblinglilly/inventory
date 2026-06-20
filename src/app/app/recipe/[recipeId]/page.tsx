import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { RecipeDetailPage } from "@/components/recipe-detail-page";

export default async function RecipePage({
  params,
}: {
  params: Promise<{ recipeId: string }>;
}) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    redirect("/auth");
  }

  const { recipeId } = await params;

  return <RecipeDetailPage recipeId={recipeId} userId={session.user.id} />;
}
