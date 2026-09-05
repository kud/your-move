"use client"

import { useEffect } from "react"

/*
 * Registration, and no more than that.
 *
 * Mounted in the root layout, so it runs on the login page too. That is safe
 * rather than merely tolerable: the worker's cache holds only the shell — the
 * offline page, the manifest, the icons, hashed build assets — and never a
 * board, so there is nothing an unauthenticated device could keep.
 *
 * `updateViaCache: "none"` pairs with the no-store header on `/sw.js` in
 * `next.config.ts`. Without both, a browser may serve the worker script itself
 * from HTTP cache for up to a day, and a caching bug then outlives its own fix.
 */
export const ServiceWorker = () => {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return

    /* A failed registration is not worth a visible error: the board works
       without a worker, and the only cost is that a cold offline launch falls
       back to the browser's own error page. */
    navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .catch(() => {})
  }, [])

  return null
}
