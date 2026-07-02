import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getInventoryAccessForUser } from "@/lib/inventory-sharing";

export async function getServerSession() {
  return auth.api.getSession({
    headers: await headers(),
  });
}

export async function requireServerSession() {
  const session = await getServerSession();

  if (!session) {
    redirect("/auth");
  }

  return session;
}

export async function getServerInventoryAccess() {
  const session = await getServerSession();

  if (!session) {
    return null;
  }

  const access = await getInventoryAccessForUser(session.user.id);
  return { session, access };
}

export async function requireServerInventoryAccess() {
  const session = await requireServerSession();
  const access = await getInventoryAccessForUser(session.user.id);

  return { session, access };
}
