import type { Metadata } from "next"
import dynamic from "next/dynamic"
import { Toaster } from "sonner"
import "./globals.css"
import { QueryProvider } from "../components/providers"
import { Geist, Noto_Sans, Inter, Plus_Jakarta_Sans } from "next/font/google";
import { cn } from "@/lib/utils";

const SmoothScroll = dynamic(
  () => import("@/components/smooth-scroll").then((m) => m.SmoothScroll),
  { ssr: true }
)

const inter = Inter({ subsets: ["latin"], variable: "--font-body" });

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-heading",
  weight: ["400", "500", "600", "700", "800"],
});

const notoSans = Noto_Sans({ subsets: ["latin"], variable: "--font-sans" });

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3002"

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "CamerMove — Billets de bus Yaoundé ⇄ Douala",
    template: "%s | CamerMove",
  },
  description:
    "Réservez vos billets de bus interurbains au Cameroun. Comparez les départs Yaoundé–Douala, payez par Mobile Money, recevez votre e-billet QR instantanément.",
  keywords: ["bus Cameroun", "Yaoundé Douala", "billet de bus en ligne", "réservation bus", "Mobile Money"],
  openGraph: {
    type: "website",
    locale: "fr_CM",
    siteName: "CamerMove",
    url: SITE_URL,
    title: "CamerMove — Billets de bus Yaoundé ⇄ Douala",
    description:
      "Comparez les départs, payez par Mobile Money, recevez votre e-billet QR instantanément.",
  },
  twitter: { card: "summary_large_image" },
}

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "CamerMove",
  url: SITE_URL,
  areaServed: "CM",
  slogan: "Yaoundé ⇄ Douala en un clic",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" suppressHydrationWarning className={cn("font-sans", inter.variable, plusJakarta.variable, notoSans.variable)}>
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <SmoothScroll>
          <QueryProvider>{children}</QueryProvider>
        </SmoothScroll>
        <Toaster theme="dark" position="top-center" />
      </body>
    </html>
  )
}
