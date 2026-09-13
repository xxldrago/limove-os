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
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-1">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <span className="text-sm font-bold">L</span>
          </div>
          <span className="text-lg font-semibold tracking-tight">Limove OS</span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Навигация</SidebarGroupLabel>
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
                      className="data-active:bg-accent data-active:text-accent-foreground"
                    >
                      <Icon />
                      <span>{item.label}</span>
                      {item.href === "/projects" && projectCount !== null && (
                        <span className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-semibold text-primary-foreground">
                          {projectCount}
                        </span>
                      )}
                      {item.href === "/vpn" && vpnActiveCount !== null && vpnActiveCount > 0 && (
                        <span className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-semibold text-primary-foreground">
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
        <div className="flex items-center justify-between gap-2 rounded-md p-2">
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
              <span className="text-sm font-medium">
                {userName ? userName.charAt(0).toUpperCase() : "?"}
              </span>
            </div>
            <div className="min-w-0 leading-tight">
              <p className="truncate text-sm font-medium">{userName ?? "Пользователь"}</p>
              <p className="truncate text-xs text-muted-foreground">{userEmail ?? ""}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
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