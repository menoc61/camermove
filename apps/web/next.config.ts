import type { NextConfig } from "next"
const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: "standalone",
  transpilePackages: ["@camermove/frontend"],
  experimental: {
    optimizePackageImports: ["lucide-react", "motion", "sonner"],
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "picsum.photos" },
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
  },
}
export default nextConfig
