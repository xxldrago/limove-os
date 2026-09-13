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
      <SidebarInset className="md:peer-data-[variant=inset]:m-0">
        <header className="sticky top-0 z-10 flex h-12 shrink-0 items-center gap-2 bg-background/80 backdrop-blur">
          <div className="flex items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator
              orientation="vertical"
              className="mr-2 data-[orientation=vertical]:h-4"
            />
          </div>
        </header>
        <main id="main-content" className="flex-1 animate-fade-in overflow-y-auto overflow-x-hidden p-4 md:p-6">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}