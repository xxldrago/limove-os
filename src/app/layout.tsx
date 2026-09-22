import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, JetBrains_Mono, Inter } from "next/font/google";
import "./globals.css";
import "@/lib/monitor-init";
import "@/lib/telegram-init";
import { Providers } from "@/components/providers";
import { ServiceWorkerRegister } from "@/components/service-worker-register";
import { QuickActionsFAB } from "@/components/quick-actions-fab";
import { InstallBanner } from "@/components/install-banner";

// Limove OS Finance — тёмная тема.
// Plus Jakarta Sans для латиницы/интерфейса, Inter как кириллический фолбэк
// (у Plus Jakarta Sans нет кириллицы), JetBrains Mono для цифр.
const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-sans",
});

const inter = Inter({
  subsets: ["latin", "cyrillic"],
  variable: "--font-inter",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-mono",
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
  themeColor: "#090D14",
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
    <html lang="ru" className={`${jakarta.variable} ${inter.variable} ${jetbrains.variable}`}>
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
