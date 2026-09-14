import type { ReactNode } from "react";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { SiteHeader } from "./SiteHeader";

export function DashboardShell({
  children,
  title,
}: {
  children: ReactNode;
  title?: string;
}) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <SiteHeader title={title} />
        <div className="flex flex-1 flex-col gap-4 p-4 lg:p-6">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
