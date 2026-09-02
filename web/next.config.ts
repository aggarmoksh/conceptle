import type { NextConfig } from "next";

// Phase 2: default dev/build config only. Static export (`output: "export"`)
// and the Cloudflare Pages adapter are Phase 4 concerns per CLAUDE.md phase
// gates; do not add them here.
const nextConfig: NextConfig = {};

export default nextConfig;
