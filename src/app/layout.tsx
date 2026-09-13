import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import "@/lib/monitor-init";
import "@/lib/telegram-init";
import { Providers } from "@/components/providers";
import { ServiceWorkerRegister } from "@/components/service-worker-register";
import { QuickActionsFAB } from "@/components/quick-actions-fab";
import { InstallBanner } from "@/components/install-banner";

// Основной шрифт — Inter (как на limove.ru)
const inter = Inter({
  subsets: ["latin", "cyrillic"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Limove OS",
  description: "Операционная система управления проектами Limove",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Limove OS",
  },
  icons: {
    apple: "/icons/icon-192.png",
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  },
};

export const viewport: Viewport = {
  themeColor: "#66FCF1",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" className={`${inter.variable} dark`}>
      <body className="antialiased">
        <Providers>
          {children}
          <ServiceWorkerRegister />
          <QuickActionsFAB />
          <InstallBanner />
        </Providers>
      </body>
    </html>
  );
}