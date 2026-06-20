import type { Metadata, Viewport } from "next";
import { DM_Sans, IBM_Plex_Mono } from "next/font/google";
import { ServiceWorkerReset } from "@/components/service-worker-reset";
import "./globals.css";

const sans = DM_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
});

const mono = IBM_Plex_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "Inventory",
  description: "A local-first home inventory with rooms, places, and stock alerts.",
  applicationName: "Inventory",
};

export const viewport: Viewport = {
  themeColor: "#2f5d50",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <body>
        <ServiceWorkerReset />
        {children}
      </body>
    </html>
  );
}
