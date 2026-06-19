import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { uploadInventoryImage } from "@/lib/blob";

export async function POST(request: Request) {
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ message: "Expected a file" }, { status: 400 });
  }

  const payload = await uploadInventoryImage(file);
  return NextResponse.json(payload);
}
