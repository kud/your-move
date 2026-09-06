"use client"

import { useEffect, useRef } from "react"

/*
 * Three slow radial washes drifting behind the panel. Generative rather than a
 * photograph, so it ships with the app and costs nothing to load.
 *
 * It is also the single most expensive thing on the page if drawn naively, and
 * it was: a full-viewport clear plus three freshly-allocated radial gradients
 * filling the whole screen, sixty times a second, at 2x device pixel ratio,
 * forever — including while the tab was hidden. On a phone that is enough to
 * make scrolling stutter.
 *
 * Three cheap corrections, none of which is visible:
 *   - draw at ~8fps, because the blobs move at 0.00005 rad/ms and nobody can
 *     see the difference between that at 8fps and at 60
 *   - render at half resolution and let CSS scale it up; it is a blur
 *   - stop entirely when the tab is not visible
 */
const BLOBS = [
  {
    rgb: [96, 62, 74],
    radius: 0.62,
    sx: 0.00007,
    sy: 0.000041,
    px: 0.22,
    py: 0.16,
    alpha: 0.4,
  },
  {
    rgb: [70, 74, 104],
    radius: 0.7,
    sx: 0.000052,
    sy: 0.000063,
    px: 0.78,
    py: 0.3,
    alpha: 0.34,
  },
  {
    rgb: [104, 86, 56],
    radius: 0.52,
    sx: 0.000039,
    sy: 0.000029,
    px: 0.5,
    py: 0.86,
    alpha: 0.26,
  },
]

export const Sky = () => {
  const canvas = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const element = canvas.current
    const context = element?.getContext("2d")
    if (!element || !context) return

    let frame = 0
    let last = 0

    /* A blur has no detail to lose, so half a CSS pixel per canvas pixel is
       indistinguishable and quarters the fill cost. */
    const SCALE = 0.5
    const FRAME_MS = 1000 / 8

    const fit = () => {
      element.width = Math.max(1, Math.round(innerWidth * SCALE))
      element.height = Math.max(1, Math.round(innerHeight * SCALE))
      context.setTransform(SCALE, 0, 0, SCALE, 0, 0)
    }

    const draw = (time: number) => {
      frame = requestAnimationFrame(draw)

      if (time - last < FRAME_MS) return
      last = time

      const { innerWidth: width, innerHeight: height } = window
      context.clearRect(0, 0, width, height)

      for (const blob of BLOBS) {
        const x = (blob.px + Math.sin(time * blob.sx) * 0.1) * width
        const y = (blob.py + Math.cos(time * blob.sy) * 0.09) * height
        const gradient = context.createRadialGradient(
          x,
          y,
          0,
          x,
          y,
          Math.max(width, height) * blob.radius,
        )
        const [r, g, b] = blob.rgb
        gradient.addColorStop(0, `rgba(${r},${g},${b},${blob.alpha})`)
        gradient.addColorStop(1, `rgba(${r},${g},${b},0)`)
        context.fillStyle = gradient
        context.fillRect(0, 0, width, height)
      }
    }

    /*
     * Nothing to animate for a tab nobody is looking at, and browsers throttle
     * rAF there inconsistently rather than reliably stopping it.
     *
     * And nothing to animate when the canvas is not on screen at all. Three
     * modes hide it in CSS — high contrast, the light theme, reduced motion —
     * and every one of them left this loop running: allocating three radial
     * gradients and filling the viewport, eight times a second, to paint an
     * element with `display: none`. Hidden is not stopped, and the bill was
     * being paid by exactly the people who asked for less.
     *
     * Read from the computed style rather than re-deriving those conditions
     * here, so the CSS stays the only place that decides, and a fourth mode
     * added later needs nothing in this file.
     */
    const wanted = () =>
      document.visibilityState === "visible" &&
      getComputedStyle(element).display !== "none"

    const settle = () => {
      cancelAnimationFrame(frame)
      if (wanted()) frame = requestAnimationFrame(draw)
    }

    fit()
    addEventListener("resize", fit)
    document.addEventListener("visibilitychange", settle)

    /* The attributes those CSS rules key off. Cheap: they change when someone
       taps a setting, not on a timer. */
    const modes = new MutationObserver(settle)
    modes.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme", "data-contrast", "data-motion"],
    })

    const scheme = matchMedia("(prefers-color-scheme: light)")
    scheme.addEventListener("change", settle)

    settle()

    return () => {
      cancelAnimationFrame(frame)
      removeEventListener("resize", fit)
      document.removeEventListener("visibilitychange", settle)
      modes.disconnect()
      scheme.removeEventListener("change", settle)
    }
  }, [])

  return (
    <>
      <canvas
        ref={canvas}
        aria-hidden
        className="fixed inset-0 z-0 h-full w-full opacity-55"
      />
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-[1]"
        style={{
          background:
            "radial-gradient(120% 80% at 50% 0%, transparent 20%, var(--color-void) 78%)",
        }}
      />

      {/*
        The page meets the system bars in flat ground, not in a gradient.

        The stops are an eased ramp rather than the two-stop one this started
        with, and that is a banding fix rather than a taste one. Going from
        #0b0c0e to transparent over about eighty pixels, above a sky that
        differs from it by a handful of RGB steps, gives each step twenty pixels
        of width — which stops reading as a fade and starts reading as a line.
        An OLED panel at low luminance is exactly where that shows.

        Android paints the status bar with a single colour from the manifest's
        theme_color, so a wash running all the way to the top edge butts against
        an aplat and reads as a seam — the app looking pasted onto the phone
        rather than part of it. Fading to exactly --color-void over the first
        inch puts the boundary where both sides are the same colour and there is
        nothing left to see. Same at the bottom, for the gesture bar.
      */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 top-0 z-[1] h-[max(96px,calc(env(safe-area-inset-top)+72px))]"
        style={{
          background:
            "linear-gradient(to bottom, var(--color-void) 0%, var(--color-void) 30%, color-mix(in srgb, var(--color-void) 94%, transparent) 40%, color-mix(in srgb, var(--color-void) 82%, transparent) 50%, color-mix(in srgb, var(--color-void) 63%, transparent) 61%, color-mix(in srgb, var(--color-void) 41%, transparent) 73%, color-mix(in srgb, var(--color-void) 19%, transparent) 86%, transparent 100%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[1] h-[max(72px,calc(env(safe-area-inset-bottom)+56px))]"
        style={{
          background:
            "linear-gradient(to top, var(--color-void) 0%, var(--color-void) 30%, color-mix(in srgb, var(--color-void) 94%, transparent) 40%, color-mix(in srgb, var(--color-void) 82%, transparent) 50%, color-mix(in srgb, var(--color-void) 63%, transparent) 61%, color-mix(in srgb, var(--color-void) 41%, transparent) 73%, color-mix(in srgb, var(--color-void) 19%, transparent) 86%, transparent 100%)",
        }}
      />
    </>
  )
}
