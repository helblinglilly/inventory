import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getInventoryBootstrapPayload } from "@/lib/inventory-bootstrap";
import { getInventoryAccessForUser } from "@/lib/inventory-sharing";

export async function GET(request: Request) {
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const access = await getInventoryAccessForUser(session.user.id);
  const payload = await getInventoryBootstrapPayload(access);

  return NextResponse.json(payload);
}
