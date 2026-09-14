import type { Metadata, Viewport } from "next";
import dynamic from "next/dynamic";
import { Toaster } from "sonner";
import "./globals.css";

import { RouteAwareNav } from "../components/route-aware-nav";
import { PageTransition } from "../components/page-transition";
import { BackToTop } from "../components/back-to-top";
import { ServiceWorkerRegister } from "../components/service-worker-register";
import { QueryProvider } from "../components/providers";
import { TooltipProvider } from "@/components/ui/tooltip";

import { Inter } from "next/font/google";

const SmoothScroll = dynamic(
  () => import("@/components/smooth-scroll").then((m) => m.SmoothScroll),
  { ssr: false },
);

/* Helvetica-first stack via Inter as a close web analogue.
   Only the weights actually used by the codebase (400/500/600/700) are
   loaded — requesting extras makes Next.js preload their woff2 files,
   which the browser then warns about when they go unused. */
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["400", "500", "600", "700"],
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3002";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "CamerMove — Mobilité, transport et services au Cameroun",
    template: "%s | CamerMove",
  },
  description:
    "CamerMove est la plateforme multi-services dédiée à la mobilité au Cameroun : transport interurbain, hôtels, location de véhicules, colis, assurance et événements.",
  keywords: [
    "CamerMove",
    "mobilité Cameroun",
    "bus Yaoundé Douala",
    "réservation transport",
    "Mobile Money",
  ],
  openGraph: {
    type: "website",
    locale: "fr_CM",
    siteName: "CamerMove",
    url: SITE_URL,
    title: "CamerMove — Mobilité, transport et services au Cameroun",
    description:
      "Une plateforme, six services. Comparez, réservez, payez en Mobile Money, voyagez léger.",
  },
  twitter: { card: "summary_large_image" },
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icon-192.png", sizes: "192x192", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    title: "CamerMove",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  themeColor: "#0E0E0E",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "CamerMove",
  url: SITE_URL,
  areaServed: "CM",
  slogan: "Réinventons la mobilité africaine",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" suppressHydrationWarning className={inter.variable}>
      <body className="font-body antialiased">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <TooltipProvider>
          <div className="App">
            <SmoothScroll>
              <QueryProvider>
                <RouteAwareNav />
                <PageTransition>{children}</PageTransition>
                <BackToTop />
              </QueryProvider>
            </SmoothScroll>
          </div>
          <ServiceWorkerRegister />
          <Toaster theme="dark" position="top-center" />
        </TooltipProvider>
      </body>
    </html>
  );
}
