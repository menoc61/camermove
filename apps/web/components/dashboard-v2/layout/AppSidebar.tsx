"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuthStore } from "@camermove/frontend";
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
} from "@/components/ui/sidebar";
import {
  LayoutDashboardIcon,
  TicketIcon,
  PackageIcon,
  ShieldCheckIcon,
  CalendarDaysIcon,
  BedDoubleIcon,
  CarIcon,
  LifeBuoyIcon,
  SettingsIcon,
  CalendarClockIcon,
} from "lucide-react";

const mainNav = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboardIcon },
  { href: "/dashboard#bookings", label: "Mes réservations", icon: CalendarClockIcon },
  { href: "/tickets/lookup", label: "Billets", icon: TicketIcon },
  { href: "/parcels", label: "Colis", icon: PackageIcon },
  { href: "/insurance", label: "Assurance", icon: ShieldCheckIcon },
  { href: "/events", label: "Événements", icon: CalendarDaysIcon },
  { href: "/hotels", label: "Hôtels", icon: BedDoubleIcon },
  { href: "/rentals", label: "Location", icon: CarIcon },
] as const;

const supportNav = [
  { href: "/contact", label: "Support", icon: LifeBuoyIcon },
] as const;

export function AppSidebar(props: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);
  const role = user?.role;
  const showAdmin = role === "admin" || role === "super_admin";

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<Link href="/" />}>
              <span className="font-semibold tracking-widest">CamerMove</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Menu</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNav.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    isActive={pathname === item.href}
                    tooltip={item.label}
                    render={<Link href={item.href} />}
                  >
                    <item.icon />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
              {showAdmin && (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    isActive={pathname === "/admin"}
                    tooltip="Administration"
                    render={<Link href="/admin" />}
                  >
                    <SettingsIcon />
                    <span>Administration</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Compte</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {supportNav.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    isActive={pathname === item.href}
                    tooltip={item.label}
                    render={<Link href={item.href} />}
                  >
                    <item.icon />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
            <p className="truncate px-3 pt-2 text-xs text-muted-foreground">
              {user?.email ?? "Non connecté"}
            </p>
            <p className="truncate px-3 text-xs capitalize text-muted-foreground">
              Yaoundé · Douala · Cameroun
            </p>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <p className="px-3 py-2 text-xs text-muted-foreground">
          © 2026 CamerMove
        </p>
      </SidebarFooter>
    </Sidebar>
  );
}
