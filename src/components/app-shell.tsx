"use client";

import * as React from "react";
import { usePathname } from "next/navigation";

import {
  SidebarProvider,
  SidebarTrigger,
  SidebarInset,
} from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Separator } from "@/components/ui/separator";

export function AppShell({
  children,
  userName,
  userEmail,
}: {
  children: React.ReactNode;
  userName?: string;
  userEmail?: string;
}) {
  const pathname = usePathname();

  React.useEffect(() => {
    const main = document.getElementById("main-content");
    if (main) main.scrollTo(0, 0);
  }, [pathname]);

  return (
    <SidebarProvider defaultOpen={true}>
      <AppSidebar userName={userName} userEmail={userEmail} />
      <SidebarInset className="app-inset">
        <header className="glass-panel app-header">
          <SidebarTrigger className="btn btn-icon btn-ghost" />
          <Separator orientation="vertical" className="sep-header" />
          <span className="app-header-label">LIMOVE OS · FINANCE</span>
        </header>
        <main id="main-content" className="app-main animate-fade-in">
          <div className="app-container">{children}</div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
