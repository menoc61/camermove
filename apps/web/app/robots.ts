import type { MetadataRoute } from "next"

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3002"

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        // Public pages — allow key marketing pages
        allow: [
          "/",
          "/become-partner",
          "/transporter/apply",
        ],
        // Protected/private pages — disallow authenticated areas
        disallow: [
          "/admin/",
          "/api/",
          "/dashboard/",
          "/tickets/",
          "/transporter/",
          "/book/",
          "/login",
          "/register",
          "/auth/",
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  }
}
