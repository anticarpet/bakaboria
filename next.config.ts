import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        // Google profile pictures (lh3.googleusercontent.com)
        protocol: "https",
        hostname: "**.googleusercontent.com",
      },
    ],
  },
};

module.exports = {
  devIndicators: false,
  images: nextConfig.images,
};

export default nextConfig;
