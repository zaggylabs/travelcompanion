import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Static export: the app runs entirely in the browser, so it can be hosted
  // on any static host (Cloudflare Pages, GitHub Pages, Netlify...). Output goes to `out/`.
  output: "export",
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
