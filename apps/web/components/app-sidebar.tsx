"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useAuthStore } from "@camermove/frontend"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import "./yolo/yolo.css"

// Yolo exact sidebar — desktop-first, name Navigation, animation as Yolo-web 425295e
// We keep Sidebar shell for SidebarProvider compatibility but render Yolo nav-columns inside
// Desktop-first tokens: yellow #fff3d8, black #000, container 1560->1280->1080
export function AppSidebar(props: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname()
  const user = useAuthStore((s) => s.user)
  const role = user?.role
  const isActive = (href: string) => pathname === href

  return (
    <Sidebar collapsible="offcanvas" {...props} className="yolo-sidebar">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton render={<Link href="/" />}>
              <span className="text-base font-semibold tracking-[0.5rem]" style={{ fontFamily: "Josefin Sans, sans-serif" }}>CamerMove</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent className="yolo-nav" style={{ position: "static", display: "block", height: "auto", background: "var(--yolo-yellow, #fff3d8)", overflow: "visible" } as React.CSSProperties}>
        <div className="nav-columns" style={{ transform: "none", padding: "24px 0 24px 16px", flexDirection: "column", gap: "32px" }}>
          <div className="nav-column" style={{ width: "100%" }}>
            <div className="nav-label">Menu</div>
            <ul className="nav-links">
              <li><Link href="/dashboard" style={{ fontSize: "1.6rem" }} data-active={isActive("/dashboard")}>Overview</Link></li>
              <li><Link href="/dashboard#bookings" style={{ fontSize: "1.6rem" }}>Mes réservations</Link></li>
              <li><Link href="/tickets/lookup" style={{ fontSize: "1.6rem" }}>Billets</Link></li>
              <li><Link href="/parcels" style={{ fontSize: "1.6rem" }}>Colis</Link></li>
              <li><Link href="/insurance" style={{ fontSize: "1.6rem" }}>Assurance</Link></li>
              <li><Link href="/events" style={{ fontSize: "1.6rem" }}>Événements</Link></li>
              <li><Link href="/hotels" style={{ fontSize: "1.6rem" }}>Hôtels</Link></li>
              <li><Link href="/rentals" style={{ fontSize: "1.6rem" }}>Location</Link></li>
              {(role === "admin" || role === "super_admin") && <li><Link href="/admin" style={{ fontSize: "1.6rem" }}>Administration</Link></li>}
              <li><Link href="/contact" style={{ fontSize: "1.6rem" }}>Support</Link></li>
            </ul>
          </div>
          <div className="nav-column" style={{ width: "100%" }}>
            <div className="nav-label">Contact</div>
            <div className="nav-infos" style={{ flexDirection: "column", gap: "16px" }}>
              <ul className="nav-info" style={{ width: "100%" }}>
                <li className="nav-info-label">Email</li>
                <li><Link href="mailto:contact@camermove.cm">contact@camermove.cm</Link></li>
              </ul>
              <ul className="nav-info" style={{ width: "100%" }}>
                <li className="nav-info-label">Compte</li>
                <li>{user?.email ?? "Non connecté"}</li>
                {role && <li style={{ textTransform: "capitalize" }}>{role}</li>}
              </ul>
              <ul className="nav-info" style={{ width: "100%" }}>
                <li className="nav-info-label">Siège</li>
                <li>Yaoundé · Douala · Cameroun</li>
              </ul>
            </div>
          </div>
        </div>
      </SidebarContent>

      <SidebarFooter>
        <div className="px-3 py-2 text-xs" style={{ color: "#000", fontFamily: "Josefin Sans, sans-serif" }}>
          © 2026 CamerMove
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
