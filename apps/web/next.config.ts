import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  outputFileTracingRoot: workspaceRoot,
  turbopack: {
    root: workspaceRoot,
  },
  transpilePackages: [
    "@cluvvi/application",
    "@cluvvi/config",
    "@cluvvi/core",
    "@cluvvi/database",
    "@cluvvi/engine",
    "@cluvvi/storage",
  ],
};

export default nextConfig;
