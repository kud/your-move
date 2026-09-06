import { readFileSync } from "node:fs"

import type { NextConfig } from "next"

/*
 * What this build is, frozen at build time.
 *
 * Two different questions, and the app should answer both: `version` is what
 * was released, `commit` is what is actually running. Today they are usually
 * the same; the day a deploy lags — which cost twenty minutes of chasing a bug
 * that was only an old bundle — they are not, and the second is the one that
 * settles it.
 *
 * Read from `package.json` rather than duplicated, so `git lzv` remains the
 * only place a version is written.
 */
const pkg = JSON.parse(
  readFileSync(new URL("./package.json", import.meta.url), "utf8"),
) as { version: string }

const config: NextConfig = {
  env: {
    NEXT_PUBLIC_VERSION: pkg.version,
    /* Vercel injects the SHA at build; locally there is no deploy to name. */
    NEXT_PUBLIC_COMMIT: (process.env.VERCEL_GIT_COMMIT_SHA ?? "").slice(0, 7),
  },

  /*
   * The one file that must never be cached.
   *
   * A service worker is fetched over HTTP like anything else, and a browser is
   * entitled to reuse a cached copy of the script for up to 24 hours. So a bug
   * in the worker's own caching policy keeps shipping for a day after it is
   * fixed, on exactly the devices that already installed it — the failure mode
   * that gives service workers their reputation. `updateViaCache: "none"` at
   * the registration site (`components/service-worker.tsx`) and this header are
   * the two halves of the same guarantee; neither is sufficient alone.
   */
  headers: async () => [
    {
      source: "/sw.js",
      headers: [
        {
          key: "Cache-Control",
          value: "no-cache, no-store, must-revalidate",
        },
      ],
    },
  ],
}

export default config
