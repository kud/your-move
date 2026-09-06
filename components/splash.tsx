"use client"

import { useEffect, useState } from "react"

/*
 * The launch screen, and it exists for one honest reason: an installed PWA opens
 * on the manifest's `background_color` and then, a beat later, on whatever the
 * page renders. Without something in between, that beat reads as a stall — the
 * app looks like it failed to start rather than like it is starting.
 *
 * So this paints the same ground the OS splash used, puts the wordmark where the
 * header's will be, and hands over. It is not a loading indicator: it never
 * waits for the network, because a splash that outlives the data is just a
 * slower app.
 */

/* Long enough to register as deliberate, short enough never to be in the way. */
const HOLD_MS = 520
const FADE_MS = 420

export const Splash = () => {
  const [state, setState] = useState<"in" | "out" | "gone">("in")

  useEffect(() => {
    /* Only on a real launch. In a browser tab this is a flash of chrome nobody
       asked for, and the OS splash it exists to bridge never happened. */
    const standalone =
      matchMedia("(display-mode: standalone)").matches ||
      (navigator as { standalone?: boolean }).standalone === true

    if (!standalone || matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setState("gone")
      return
    }

    const out = setTimeout(() => setState("out"), HOLD_MS)
    const gone = setTimeout(() => setState("gone"), HOLD_MS + FADE_MS)
    return () => {
      clearTimeout(out)
      clearTimeout(gone)
    }
  }, [])

  if (state === "gone") return null

  return (
    <div
      aria-hidden
      className="fixed inset-0 z-50 grid place-items-center bg-void transition-opacity duration-[420ms] ease-out"
      style={{ opacity: state === "out" ? 0 : 1 }}
    >
      {/* One warm wash behind the mark, the same family as `Sky` so the handover
          is a continuation rather than a cut. */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(70% 50% at 50% 42%, rgba(224,112,124,.16), transparent 70%)",
        }}
      />

      <div className="ym-splash relative text-center">
        <p className="font-serif text-[34px] font-semibold leading-tight tracking-[-0.02em] text-fg">
          Your Move
        </p>
        <p className="mt-1 text-[13px] text-fg-quiet">
          what moved, and whose move it is
        </p>
      </div>
    </div>
  )
}
