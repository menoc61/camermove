import type { Metadata } from "next"
import "./globals.css"
import { QueryProvider } from "../components/providers"
export const metadata: Metadata = {
  title: "CamerMove",
  description: "Réservez vos billets de bus entre Yaoundé et Douala",
}
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body>
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  )
}
