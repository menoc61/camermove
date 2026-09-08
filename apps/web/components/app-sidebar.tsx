"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"

import { useAuthStore } from "@camermove/frontend"

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
} from "@/components/ui/sidebar"
import {
  BusIcon,
  PackageIcon,
  ShieldIcon,
  TicketIcon,
  BedIcon,
  CarIcon,
  CalendarIcon,
  BellIcon,
  LayoutDashboardIcon,
  LifeBuoyIcon,
} from "lucide-react"

interface NavItem {
  title: string
  url: string
  icon: React.ReactNode
  roles?: string[]
}

const overview: NavItem[] = [
  { title: "Overview", url: "/dashboard", icon: <LayoutDashboardIcon /> },
  { title: "My Bookings", url: "/dashboard#bookings", icon: <TicketIcon /> },
  { title: "Notifications", url: "/dashboard#notifications", icon: <BellIcon /> },
]

const services: NavItem[] = [
  { title: "Tickets", url: "/tickets/lookup", icon: <TicketIcon /> },
  { title: "Parcels", url: "/parcels", icon: <PackageIcon /> },
  { title: "Insurance", url: "/insurance", icon: <ShieldIcon /> },
  { title: "Events", url: "/events", icon: <CalendarIcon /> },
  { title: "Hotels", url: "/hotels", icon: <BedIcon /> },
  { title: "Rentals", url: "/rentals", icon: <CarIcon /> },
]

const partner: NavItem[] = [
  {
    title: "Hotels",
    url: "/partner/hotels",
    icon: <BedIcon />,
    roles: ["partner"],
  },
  {
    title: "Rentals",
    url: "/partner/rentals",
    icon: <CarIcon />,
    roles: ["partner"],
  },
  {
    title: "Transporter",
    url: "/transporter/dashboard",
    icon: <BusIcon />,
    roles: ["transporter"],
  },
]

const admin: NavItem[] = [
  { title: "Admin", url: "/admin", icon: <LayoutDashboardIcon />, roles: ["admin", "super_admin"] },
]

const secondary: NavItem[] = [
  { title: "Support", url: "/contact", icon: <LifeBuoyIcon /> },
]

function filterByRole(items: NavItem[], role: string | undefined) {
  return items.filter((i) => !i.roles || (role && i.roles.includes(role)))
}

function NavSection({ label, items, pathname }: { label: string; items: NavItem[]; pathname: string }) {
  if (items.length === 0) return null
  return (
    <SidebarGroup>
      <SidebarGroupLabel>{label}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.url}>
              <SidebarMenuButton
                render={<Link href={item.url} />}
                isActive={pathname === item.url}
                tooltip={item.title}
              >
                {item.icon}
                <span>{item.title}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname()
  const user = useAuthStore((s) => s.user)

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              className="data-[slot=sidebar-menu-button]:p-1.5!"
              render={<Link href="/" />}
            >
              <BusIcon className="size-5!" />
              <span className="text-base font-semibold">CamerMove</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavSection
          label="Overview"
          items={filterByRole(overview, user?.role)}
          pathname={pathname}
        />
        <NavSection
          label="My Services"
          items={filterByRole(services, user?.role)}
          pathname={pathname}
        />
        <NavSection
          label="Partner"
          items={filterByRole(partner, user?.role)}
          pathname={pathname}
        />
        <NavSection
          label="Administration"
          items={filterByRole(admin, user?.role)}
          pathname={pathname}
        />
        <NavSection
          label="Account"
          items={filterByRole(secondary, user?.role)}
          pathname={pathname}
        />
      </SidebarContent>
      <SidebarFooter>
        <div className="px-3 py-2 text-xs text-muted-foreground">
          {user?.email ?? "Not signed in"}
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
