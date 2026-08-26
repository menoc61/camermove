import type { NextConfig } from "next"
const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@camermove/frontend"],
  images: {
    remotePatterns: [{ protocol: "https", hostname: "picsum.photos" }],
  },
}
export default nextConfig
