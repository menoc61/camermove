import type { Metadata } from "next"
import { AdminShell } from "../../components/admin/AdminShell"

export const metadata: Metadata = {
  title: "Console d'administration",
  robots: { index: false, follow: false },
}

export default function AdminPage() {
  return <AdminShell />
}
