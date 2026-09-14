import type { MetadataRoute } from "next"

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3002"

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date()
  return [
    { url: SITE_URL, lastModified, changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/results`, lastModified, changeFrequency: "daily", priority: 0.9 },
    { url: `${SITE_URL}/hotels`, lastModified, changeFrequency: "daily", priority: 0.8 },
    { url: `${SITE_URL}/rentals`, lastModified, changeFrequency: "daily", priority: 0.8 },
    { url: `${SITE_URL}/parcels`, lastModified, changeFrequency: "daily", priority: 0.8 },
    { url: `${SITE_URL}/events`, lastModified, changeFrequency: "daily", priority: 0.8 },
    { url: `${SITE_URL}/insurance`, lastModified, changeFrequency: "weekly", priority: 0.7 },
    { url: `${SITE_URL}/faq`, lastModified, changeFrequency: "monthly", priority: 0.6 },
    { url: `${SITE_URL}/how-it-works`, lastModified, changeFrequency: "monthly", priority: 0.6 },
    { url: `${SITE_URL}/legal`, lastModified, changeFrequency: "monthly", priority: 0.5 },
    { url: `${SITE_URL}/contact`, lastModified, changeFrequency: "monthly", priority: 0.5 },
    { url: `${SITE_URL}/become-partner`, lastModified, changeFrequency: "monthly", priority: 0.5 },
    { url: `${SITE_URL}/login`, lastModified, changeFrequency: "monthly", priority: 0.3 },
    { url: `${SITE_URL}/register`, lastModified, changeFrequency: "monthly", priority: 0.3 },
  ]
}
