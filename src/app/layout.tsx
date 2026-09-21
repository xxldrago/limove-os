import type { Metadata, Viewport } from "next";
import { Inter, Poppins, Roboto_Mono, Nunito_Sans } from "next/font/google";
import "./globals.css";
import "@/lib/monitor-init";
import "@/lib/telegram-init";
import { Providers } from "@/components/providers";
import { ServiceWorkerRegister } from "@/components/service-worker-register";
import { QuickActionsFAB } from "@/components/quick-actions-fab";
import { InstallBanner } from "@/components/install-banner";

// Основной шрифт — Inter (как на limove.ru)
// Maple Ridge: Poppins для заголовков, Roboto Mono для цифр, Nunito Sans для текста
const inter = Inter({
  subsets: ["latin", "cyrillic"],
  variable: "--font-inter",
});

const poppins = Poppins({
  weight: ["500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-display",
});

const robotoMono = Roboto_Mono({
  weight: ["400", "500", "600"],
  subsets: ["latin", "cyrillic"],
  variable: "--font-roboto-mono",
});

const nunitoSans = Nunito_Sans({
  weight: ["400", "600", "700"],
  subsets: ["latin", "cyrillic"],
  variable: "--font-body",
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
  themeColor: "#F2F5F8",
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
    <html
      lang="ru"
      className={`${inter.variable} ${poppins.variable} ${robotoMono.variable} ${nunitoSans.variable}`}
    >
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