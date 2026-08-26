import type { MetadataRoute } from "next"

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3002"

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date()
  return [
    { url: SITE_URL, lastModified, changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/results`, lastModified, changeFrequency: "daily", priority: 0.9 },
    { url: `${SITE_URL}/tickets/lookup`, lastModified, changeFrequency: "monthly", priority: 0.6 },
  ]
}
