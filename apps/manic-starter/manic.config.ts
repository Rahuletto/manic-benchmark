import { defineConfig } from "manicjs/config";
import { mcp } from "@manicjs/mcp";
import { seo } from "@manicjs/seo";
import { sitemap } from "@manicjs/sitemap";

export default defineConfig({
  mode: "frontend",

  app: {
    name: "manic-starter",
  },

  server: {
    port: 6070,
  },

  router: {
    viewTransitions: true,
  },
  plugins: [
    mcp(),
    seo({
      hostname: "https://bench.local",
    }),
    sitemap({
      hostname: "https://bench.local",
    }),
  ],
});
