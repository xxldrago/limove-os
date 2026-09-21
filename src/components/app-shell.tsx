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
      <SidebarInset className="md:peer-data-[variant=inset]:m-0 !bg-[#F2F5F8]">
        <header className="sticky top-0 z-10 flex h-[66px] shrink-0 items-center gap-2 border-b border-[#e4e9ef] bg-white">
          <div className="flex items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1 rounded-[12px] bg-[#f5f8fa] text-[#354354] hover:bg-[#eaf1f8] hover:text-[#16548f]" />
            <Separator
              orientation="vertical"
              className="mr-2 bg-[#e4e9ef] data-[orientation=vertical]:h-4"
            />
            <span className="num hidden text-xs font-medium tracking-wide text-[#8a97a6] sm:block">
              LIMOVE OS · FERNBROOK THEME
            </span>
          </div>
        </header>
        <main id="main-content" className="num flex-1 animate-fade-in overflow-y-auto overflow-x-hidden bg-[#F2F5F8] px-6 py-6 text-[#0f1720]">
          <div className="mx-auto max-w-[1380px]">{children}</div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}