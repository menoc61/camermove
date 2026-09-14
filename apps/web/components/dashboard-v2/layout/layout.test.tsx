import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const appSidebarPath = join(here, "AppSidebar.tsx");
const siteHeaderPath = join(here, "SiteHeader.tsx");
const shellPath = join(here, "DashboardShell.tsx");

function read(p: string): string {
  return readFileSync(p, "utf8");
}

function lineCount(src: string): number {
  return src.split("\n").length;
}

describe("dashboard-v2 layout contract (shadcn composition)", () => {
  it("ships AppSidebar, SiteHeader, DashboardShell", () => {
    expect(existsSync(appSidebarPath), "AppSidebar.tsx missing").toBe(true);
    expect(existsSync(siteHeaderPath), "SiteHeader.tsx missing").toBe(true);
    expect(existsSync(shellPath), "DashboardShell.tsx missing").toBe(true);
  });

  it("AppSidebar uses SidebarGroup + SidebarMenuButton + SidebarFooter, no legacy markup", () => {
    const src = read(appSidebarPath);
    for (const token of [
      "SidebarGroup",
      "SidebarGroupLabel",
      "SidebarGroupContent",
      "SidebarMenu",
      "SidebarMenuItem",
      "SidebarMenuButton",
      "SidebarFooter",
      "SidebarContent",
      "SidebarHeader",
    ]) {
      expect(src, `AppSidebar must use ${token}`).toContain(token);
    }
    expect(src, "no custom .nav-columns divs").not.toContain("nav-columns");
    expect(src, "no custom .nav-column divs").not.toContain("nav-column");
    expect(src, "no inline fontSize").not.toContain("fontSize");
    expect(lineCount(src), "AppSidebar must stay <300 lines").toBeLessThan(300);
  });

  it("SiteHeader uses Breadcrumb + Separator + SidebarTrigger", () => {
    const src = read(siteHeaderPath);
    for (const token of [
      "SidebarTrigger",
      "Separator",
      "Breadcrumb",
      "BreadcrumbList",
      "BreadcrumbItem",
    ]) {
      expect(src, `SiteHeader must use ${token}`).toContain(token);
    }
    expect(src, "no inline fontSize").not.toContain("fontSize");
    expect(lineCount(src), "SiteHeader must stay <300 lines").toBeLessThan(300);
  });

  it("DashboardShell composes SidebarProvider + SidebarInset + AppSidebar + SiteHeader", () => {
    const src = read(shellPath);
    for (const token of [
      "SidebarProvider",
      "SidebarInset",
      "AppSidebar",
      "SiteHeader",
    ]) {
      expect(src, `DashboardShell must use ${token}`).toContain(token);
    }
    expect(src, "no custom .nav-columns divs").not.toContain("nav-columns");
    expect(src, "no inline fontSize").not.toContain("fontSize");
    expect(lineCount(src), "DashboardShell must stay <300 lines").toBeLessThan(
      300,
    );
  });
});
