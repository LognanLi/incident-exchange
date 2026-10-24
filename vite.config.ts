/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "edge-runtime",
    // toy-apps has its own node:test suite (npm run test:toys).
    exclude: ["**/node_modules/**", "toy-apps/**", "e2e/**", "sample-repos/**"],
    server: { deps: { inline: ["convex-test"] } },
    setupFiles: ["tests/setup-env.ts"],
  },
});
