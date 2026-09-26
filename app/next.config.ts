import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root to this app: the repo also has a root-level
  // package-lock.json (for the standalone listener script), which otherwise
  // makes Turbopack guess the wrong project root.
  turbopack: {
    root: fileURLToPath(new URL(".", import.meta.url)),
  },
};

export default nextConfig;
