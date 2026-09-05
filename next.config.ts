import type { NextConfig } from "next"

const config: NextConfig = {
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
