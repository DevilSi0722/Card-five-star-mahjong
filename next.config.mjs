import { PHASE_DEVELOPMENT_SERVER } from "next/constants.js";
import { fileURLToPath } from "node:url";

/** @type {import('next').NextConfig} */
const nextConfig = (phase) => {
  return {
    reactStrictMode: true,
    outputFileTracingRoot: fileURLToPath(new URL(".", import.meta.url)),
    distDir: phase === PHASE_DEVELOPMENT_SERVER ? ".next-dev" : ".next",
    experimental: { cpus: Number(process.env.NEXT_BUILD_CPUS || 2) },
  };
};

export default nextConfig;
