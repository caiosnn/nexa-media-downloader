import type { NextConfig } from "next";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const __dir = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

const nextConfig: NextConfig = {
  turbopack: {
    root: __dir,
    resolveAlias: {
      tailwindcss: require.resolve("tailwindcss"),
      "tw-animate-css": join(__dir, "node_modules/tw-animate-css/dist/tw-animate.css"),
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'picsum.photos',
      },
      {
        protocol: 'https',
        hostname: '**.cdninstagram.com',
      },
      {
        protocol: 'https',
        hostname: 'instagram.com',
      },
      {
        protocol: 'https',
        hostname: '**.instagram.com',
      },
      {
        protocol: 'https',
        hostname: 'scontent.cdninstagram.com',
      },
      {
        protocol: 'https',
        hostname: '**.fbcdn.net',
      },
    ],
  },
};

export default nextConfig;
