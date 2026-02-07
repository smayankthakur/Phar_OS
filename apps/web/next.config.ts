import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@pharos/db", "@pharos/core"],
};

export default nextConfig;
