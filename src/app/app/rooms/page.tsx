import { RoomsPage } from "@/components/rooms-page";
import { requireServerSession } from "@/lib/session";

export default async function RoomsRoute() {
  const session = await requireServerSession();
  return <RoomsPage userId={session.user.id} />;
}
