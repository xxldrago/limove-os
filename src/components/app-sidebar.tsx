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
        <div className="sb-head">
          <div className="sb-logo">
            <span>L</span>
          </div>
          <span className="sb-brand">Limove OS</span>
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
                    >
                      <Icon />
                      <span>{item.label}</span>
                      {item.href === "/projects" && projectCount !== null && (
                        <span className="sb-count">
                          {projectCount}
                        </span>
                      )}
                      {item.href === "/vpn" && vpnActiveCount !== null && vpnActiveCount > 0 && (
                        <span className="sb-count">
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
        <div className="sb-user">
          <div className="sb-user-id">
            <div className="sb-avatar">
              <span>
                {userName ? userName.charAt(0).toUpperCase() : "?"}
              </span>
            </div>
            <div style={{ minWidth: 0, lineHeight: 1.2 }}>
              <p className="sb-user-name">{userName ?? "Пользователь"}</p>
              <p className="sb-user-mail">{userEmail ?? ""}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
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
