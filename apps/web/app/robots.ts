import type { MetadataRoute } from "next"

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3002"

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        // Partner application page is publicly marketed - allow it explicitly
        // even though the transporter portal itself stays out of search.
        allow: ["/", "/transporter/apply"],
        disallow: ["/admin", "/api/", "/dashboard", "/tickets/", "/transporter"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  }
}
