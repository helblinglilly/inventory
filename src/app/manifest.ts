import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Inventory",
    short_name: "Inventory",
    description: "A home inventory for rooms, places, and stock alerts.",
    start_url: "/app",
    display: "standalone",
    background_color: "#f5efe6",
    theme_color: "#2f5d50",
    icons: [
      {
        src: "/icon-192.svg",
        sizes: "192x192",
        type: "image/svg+xml",
      },
      {
        src: "/icon-512.svg",
        sizes: "512x512",
        type: "image/svg+xml",
      },
    ],
  };
}
