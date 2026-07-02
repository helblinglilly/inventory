import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import {
  canUserManageInventoryInvites,
  createInventoryInvite,
  getInventoryAccessForUser,
} from "@/lib/inventory-sharing";

const inviteSchema = z.object({
  email: z.string().email(),
});

export async function POST(request: Request) {
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const canManage = await canUserManageInventoryInvites(session.user.id);

  if (!canManage) {
    return NextResponse.json(
      { message: "Only the inventory owner can invite people" },
      { status: 403 },
    );
  }

  const access = await getInventoryAccessForUser(session.user.id);
  const body = inviteSchema.parse(await request.json());

  try {
    const invite = await createInventoryInvite({
      ownerUserId: access.inventoryUserId,
      invitedByUserId: session.user.id,
      email: body.email,
    });

    return NextResponse.json({ invite });
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "Unable to create invite",
      },
      { status: 400 },
    );
  }
}
