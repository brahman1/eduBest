import type { NextConfig } from "next";
const config: NextConfig = {
  transpilePackages: ["@edubest/shared"],
  output: "standalone",
  poweredByHeader: false,
  async rewrites() {
    if (process.env.NEXT_PUBLIC_EDUBEST_PUBLIC_SITE_ONLY === "true")
      return [{ source: "/api/:path*", destination: "/service-unavailable" }];
    return [
      {
        source: "/api/:path*",
        destination: `${process.env.API_INTERNAL_URL ?? "http://127.0.0.1:4200"}/api/:path*`,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=()",
          },
          { key: "Strict-Transport-Security", value: "max-age=31536000" },
        ],
      },
      {
        source: "/api/:path*",
        headers: [
          { key: "Cache-Control", value: "private, no-store" },
          { key: "Pragma", value: "no-cache" },
        ],
      },
    ];
  },
};
export default config;
