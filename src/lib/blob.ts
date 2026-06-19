import { put } from "@vercel/blob";
import { env } from "@/lib/env";

export function toProxyImageUrl(sourceUrl: string) {
  if (!env.IMAGE_PROXY_BASE_URL) {
    return sourceUrl;
  }

  const proxyUrl = new URL(env.IMAGE_PROXY_BASE_URL);
  proxyUrl.searchParams.set("url", sourceUrl);
  return proxyUrl.toString();
}

export async function uploadInventoryImage(file: File) {
  if (!env.BLOB_READ_WRITE_TOKEN) {
    throw new Error("Missing BLOB_READ_WRITE_TOKEN");
  }

  const safeName = file.name.replace(/\s+/g, "-").toLowerCase();
  const blob = await put(`inventory/${Date.now()}-${safeName}`, file, {
    access: "public",
    token: env.BLOB_READ_WRITE_TOKEN,
    addRandomSuffix: true,
  });

  return {
    imageUrl: blob.url,
    imageProxyUrl: toProxyImageUrl(blob.url),
  };
}
