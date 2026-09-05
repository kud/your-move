import { fileURLToPath } from "node:url"
import { defineConfig } from "vitest/config"

/*
 * The `@/` alias is a tsconfig path, which vitest does not read. Without this,
 * every test that reaches a module through it fails to resolve — and it fails as
 * a missing PACKAGE, which reads like a dependency problem rather than a config
 * one and sends you looking in the wrong place.
 */
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./", import.meta.url)) },
  },
})
