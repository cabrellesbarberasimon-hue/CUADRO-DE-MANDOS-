import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@electric-sql/pglite", "exceljs"],
  experimental: { serverActions: { bodySizeLimit: "10mb" } },
};

export default nextConfig;
