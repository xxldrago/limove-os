"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Wallet,
  FolderKanban,
  FileText,
  Shield,
  Boxes,
  Activity,
  Settings,
  LogOut,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";

const navItems = [
  { href: "/", label: "Дашборд", icon: LayoutDashboard },
  { href: "/finance", label: "Финансы", icon: Wallet },
  { href: "/projects", label: "Проекты", icon: FolderKanban },
  { href: "/invoices", label: "Счета", icon: FileText },
  { href: "/vpn", label: "VPN", icon: Shield },
  { href: "/elementx", label: "ElementX", icon: Boxes },
  { href: "/monitoring", label: "Мониторинг", icon: Activity },
  { href: "/settings", label: "Настройки", icon: Settings },
];

export function AppSidebar({
  userName,
  userEmail,
}: {
  userName?: string;
  userEmail?: string;
}) {
  const pathname = usePathname();
  const [projectCount, setProjectCount] = useState<number | null>(null);
  const [vpnActiveCount, setVpnActiveCount] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/projects")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        if (Array.isArray(data)) setProjectCount(data.length);
      })
      .catch(() => {});
    fetch("/api/vpn?status=ACTIVE")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        if (Array.isArray(data)) setVpnActiveCount(data.length);
      })
      .catch(() => {});
  }, []);

  return (
    <Sidebar collapsible="icon" className="!bg-white !border-[#e4e9ef]">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-1">
          <div className="flex h-10 w-10 items-center justify-center rounded-[11px] bg-gradient-to-br from-[#1c68ad] to-[#0f3f6d] text-white shadow-[0_6px_14px_-7px_rgba(15,63,109,0.85)]">
            <span className="text-base font-bold">L</span>
          </div>
          <span className="text-lg font-semibold tracking-[-0.02em] text-[#0f1720]">Limove OS</span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-[#5d6b7c]">Навигация</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive =
                  item.href === "/"
                    ? pathname === "/"
                    : pathname.startsWith(item.href);
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      render={<Link href={item.href} />}
                      isActive={isActive}
                      className={`rounded-[12px] ${
                        isActive
                          ? "!bg-[#eaf1f8] !text-[#16548f]"
                          : "!text-[#5d6b7c] hover:!bg-[#f5f8fa] hover:!text-[#0f1720]"
                      }`}
                    >
                      <Icon />
                      <span>{item.label}</span>
                      {item.href === "/projects" && projectCount !== null && (
                        <span className="num ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full border border-[#c3d8ea] bg-[#eaf1f8] px-1.5 text-xs font-semibold text-[#0f3f6d]">
                          {projectCount}
                        </span>
                      )}
                      {item.href === "/vpn" && vpnActiveCount !== null && vpnActiveCount > 0 && (
                        <span className="num ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full border border-[#c3d8ea] bg-[#eaf1f8] px-1.5 text-xs font-semibold text-[#0f3f6d]">
                          {vpnActiveCount}
                        </span>
                      )}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarSeparator />
      <SidebarFooter>
        <div className="flex items-center justify-between gap-2 rounded-[12px] border border-[#e4e9ef] bg-[#f5f8fa] p-2">
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#c3d8ea] bg-[#eaf1f8]">
              <span className="text-sm font-bold text-[#0f3f6d]">
                {userName ? userName.charAt(0).toUpperCase() : "?"}
              </span>
            </div>
            <div className="min-w-0 leading-tight">
              <p className="truncate text-sm font-medium text-[#0f1720]">{userName ?? "Пользователь"}</p>
              <p className="num truncate text-[11px] text-[#5d6b7c]">{userEmail ?? ""}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 rounded-[12px] text-[#8a97a6] hover:bg-[#eaf1f8] hover:text-[#16548f]"
            onClick={() => signOut({ callbackUrl: "/login" })}
            aria-label="Выйти"
          >
            <LogOut />
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}