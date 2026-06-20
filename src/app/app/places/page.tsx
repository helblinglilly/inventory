import { PlacesPage } from "@/components/places-page";
import { requireServerSession } from "@/lib/session";

export default async function PlacesRoute() {
  const session = await requireServerSession();
  return <PlacesPage userId={session.user.id} />;
}
