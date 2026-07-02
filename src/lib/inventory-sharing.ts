import { asc, eq } from "drizzle-orm";
import { user } from "@/db/auth-schema";
import { inventoryInvites, inventoryShares } from "@/db/inventory-schema";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { getId } from "@/features/inventory/helpers";

export type InventoryAccess = {
  inventoryUserId: string;
  isOwner: boolean;
  ownerName: string;
  ownerEmail: string;
  viewerUserId: string;
  viewerName: string;
  viewerEmail: string;
};

export type InventoryMemberSummary = {
  userId: string;
  name: string;
  email: string;
  role: "owner" | "member";
  joinedAt: number;
};

export type InventoryInviteSummary = {
  id: string;
  email: string;
  inviteUrl: string;
  createdAt: number;
  updatedAt: number;
};

export type InventoryInvitePreview = {
  id: string;
  email: string;
  ownerUserId: string;
  ownerName: string;
};

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function getInventoryInviteUrl(inviteId: string) {
  return new URL(`/invite/${inviteId}`, env.BETTER_AUTH_URL).toString();
}

export async function getInventoryAccessForUser(userId: string): Promise<InventoryAccess> {
  const [viewerRow] = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
    })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);

  if (!viewerRow) {
    throw new Error("Signed-in user was not found");
  }

  const [membershipRow] = await db
    .select({
      ownerUserId: inventoryShares.ownerUserId,
      ownerName: user.name,
      ownerEmail: user.email,
    })
    .from(inventoryShares)
    .innerJoin(user, eq(inventoryShares.ownerUserId, user.id))
    .where(eq(inventoryShares.memberUserId, userId))
    .limit(1);

  if (!membershipRow) {
    return {
      inventoryUserId: viewerRow.id,
      isOwner: true,
      ownerName: viewerRow.name,
      ownerEmail: viewerRow.email,
      viewerUserId: viewerRow.id,
      viewerName: viewerRow.name,
      viewerEmail: viewerRow.email,
    };
  }

  return {
    inventoryUserId: membershipRow.ownerUserId,
    isOwner: false,
    ownerName: membershipRow.ownerName,
    ownerEmail: membershipRow.ownerEmail,
    viewerUserId: viewerRow.id,
    viewerName: viewerRow.name,
    viewerEmail: viewerRow.email,
  };
}

export async function listInventoryMembers(
  ownerUserId: string,
): Promise<InventoryMemberSummary[]> {
  const [ownerRow] = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      createdAt: user.createdAt,
    })
    .from(user)
    .where(eq(user.id, ownerUserId))
    .limit(1);

  if (!ownerRow) {
    return [];
  }

  const memberRows = await db
    .select({
      userId: user.id,
      name: user.name,
      email: user.email,
      joinedAt: inventoryShares.createdAt,
    })
    .from(inventoryShares)
    .innerJoin(user, eq(inventoryShares.memberUserId, user.id))
    .where(eq(inventoryShares.ownerUserId, ownerUserId))
    .orderBy(asc(inventoryShares.createdAt), asc(user.name));

  return [
    {
      userId: ownerRow.id,
      name: ownerRow.name,
      email: ownerRow.email,
      role: "owner",
      joinedAt: ownerRow.createdAt.getTime(),
    },
    ...memberRows.map((member) => ({
      userId: member.userId,
      name: member.name,
      email: member.email,
      role: "member" as const,
      joinedAt: member.joinedAt.getTime(),
    })),
  ];
}

export async function listInventoryInvites(
  ownerUserId: string,
): Promise<InventoryInviteSummary[]> {
  const inviteRows = await db
    .select({
      id: inventoryInvites.id,
      email: inventoryInvites.email,
      createdAt: inventoryInvites.createdAt,
      updatedAt: inventoryInvites.updatedAt,
    })
    .from(inventoryInvites)
    .where(eq(inventoryInvites.ownerUserId, ownerUserId))
    .orderBy(asc(inventoryInvites.createdAt));

  return inviteRows.map((invite) => ({
    id: invite.id,
    email: invite.email,
    inviteUrl: getInventoryInviteUrl(invite.id),
    createdAt: invite.createdAt.getTime(),
    updatedAt: invite.updatedAt.getTime(),
  }));
}

export async function getInventoryInviteById(
  inviteId: string,
): Promise<InventoryInvitePreview | null> {
  const [inviteRow] = await db
    .select({
      id: inventoryInvites.id,
      email: inventoryInvites.email,
      ownerUserId: inventoryInvites.ownerUserId,
      ownerName: user.name,
    })
    .from(inventoryInvites)
    .innerJoin(user, eq(inventoryInvites.ownerUserId, user.id))
    .where(eq(inventoryInvites.id, inviteId))
    .limit(1);

  return inviteRow ?? null;
}

export async function createInventoryInvite(input: {
  ownerUserId: string;
  invitedByUserId: string;
  email: string;
}) {
  const email = normalizeEmail(input.email);

  if (!email) {
    throw new Error("Email is required");
  }

  const [ownerRow] = await db
    .select({
      id: user.id,
      email: user.email,
    })
    .from(user)
    .where(eq(user.id, input.ownerUserId))
    .limit(1);

  if (!ownerRow) {
    throw new Error("Inventory owner was not found");
  }

  if (normalizeEmail(ownerRow.email) === email) {
    throw new Error("You already have access to this inventory");
  }

  const [existingUserRow] = await db
    .select({
      id: user.id,
      email: user.email,
    })
    .from(user)
    .where(eq(user.email, email))
    .limit(1);

  if (existingUserRow) {
    const [existingShareRow] = await db
      .select({
        ownerUserId: inventoryShares.ownerUserId,
      })
      .from(inventoryShares)
      .where(eq(inventoryShares.memberUserId, existingUserRow.id))
      .limit(1);

    if (existingShareRow?.ownerUserId === input.ownerUserId) {
      throw new Error("That user already has access to this inventory");
    }

    if (existingShareRow) {
      throw new Error("That user already belongs to another shared inventory");
    }
  }

  const [existingInviteRow] = await db
    .select({
      id: inventoryInvites.id,
    })
    .from(inventoryInvites)
    .where(eq(inventoryInvites.email, email))
    .limit(1);

  const now = new Date();
  const inviteId = existingInviteRow?.id ?? getId();

  if (existingInviteRow) {
    await db
      .update(inventoryInvites)
      .set({
        ownerUserId: input.ownerUserId,
        invitedByUserId: input.invitedByUserId,
        updatedAt: now,
      })
      .where(eq(inventoryInvites.id, inviteId));
  } else {
    await db.insert(inventoryInvites).values({
      id: inviteId,
      ownerUserId: input.ownerUserId,
      email,
      invitedByUserId: input.invitedByUserId,
      createdAt: now,
      updatedAt: now,
    });
  }

  return {
    id: inviteId,
    email,
    inviteUrl: getInventoryInviteUrl(inviteId),
  };
}

export async function acceptInventoryInvite(inviteId: string, memberUserId: string) {
  const invite = await getInventoryInviteById(inviteId);

  if (!invite) {
    throw new Error("This invite is invalid or has already been used");
  }

  const [memberRow] = await db
    .select({
      id: user.id,
      email: user.email,
    })
    .from(user)
    .where(eq(user.id, memberUserId))
    .limit(1);

  if (!memberRow) {
    throw new Error("Signed-in user was not found");
  }

  if (invite.ownerUserId === memberUserId) {
    throw new Error("You already own this inventory");
  }

  if (normalizeEmail(memberRow.email) !== normalizeEmail(invite.email)) {
    throw new Error("Sign in with the email address that was invited");
  }

  const [existingShareRow] = await db
    .select({
      ownerUserId: inventoryShares.ownerUserId,
    })
    .from(inventoryShares)
    .where(eq(inventoryShares.memberUserId, memberUserId))
    .limit(1);

  if (existingShareRow?.ownerUserId && existingShareRow.ownerUserId !== invite.ownerUserId) {
    throw new Error("This account already belongs to another shared inventory");
  }

  const now = new Date();

  if (!existingShareRow) {
    await db.insert(inventoryShares).values({
      id: getId(),
      ownerUserId: invite.ownerUserId,
      memberUserId,
      invitedByUserId: invite.ownerUserId,
      createdAt: now,
      updatedAt: now,
    });
  }

  await db.delete(inventoryInvites).where(eq(inventoryInvites.id, inviteId));

  return getInventoryAccessForUser(memberUserId);
}

export async function canEmailUseInviteOnlySignUp(email: string) {
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail) {
    return false;
  }

  const [inviteRow] = await db
    .select({
      id: inventoryInvites.id,
    })
    .from(inventoryInvites)
    .where(eq(inventoryInvites.email, normalizedEmail))
    .limit(1);

  return Boolean(inviteRow);
}

export async function canUserManageInventoryInvites(userId: string) {
  const access = await getInventoryAccessForUser(userId);
  return access.isOwner && access.inventoryUserId === userId;
}
