"use client"

import { useEffect, useState } from "react"

import { applyTheme, paintChrome, readTheme, type Theme } from "@/lib/theme"

/*
 * The three-way theme control, shared by the menu and the login page.
 *
 * `auto` is on the strip rather than implied, and that is the reason this is
 * three buttons and not one cycling button: `auto` is the default and the
 * answer most people should stay on, and a control that cannot show you what
 * you are currently on teaches nothing on a page seen once.
 *
 * The label lives outside. In the menu it sits among sibling rows and has to be
 * scannable against "Order"; on login there are no siblings and "light | dark"
 * names itself — so the group carries `aria-label` instead, or a screen reader
 * gets three buttons called auto/light/dark with nothing saying what they set.
 */
export const ThemeSwitch = ({ quiet = false }: { quiet?: boolean }) => {
  const [theme, setTheme] = useState<Theme>("auto")

  useEffect(() => {
    setTheme(readTheme())
    paintChrome(readTheme())
  }, [])

  /*
   * Following the system means following it as it changes, not only at load.
   *
   * This listener used to live in the menu, which never mounts on `/login` —
   * so on that page, with `theme: auto`, flipping the OS repainted the CSS (the
   * media query in globals.css does that on its own) but left `theme-color` and
   * the root background on the old ground, because both are imperative. The
   * status bar drifted out of step with the page it sits above, which is the
   * exact seam this mechanism exists to close.
   */
  useEffect(() => {
    if (theme !== "auto") return
    const media = matchMedia("(prefers-color-scheme: light)")
    const follow = () => paintChrome("auto")
    media.addEventListener("change", follow)
    return () => media.removeEventListener("change", follow)
  }, [theme])

  const choose = (next: Theme) => {
    setTheme(next)
    applyTheme(next)
  }

  return (
    <span
      role="group"
      aria-label="Theme"
      className="flex shrink-0 overflow-hidden rounded-lg border border-line"
    >
      {(["auto", "light", "dark"] as const).map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => choose(option)}
          aria-pressed={theme === option}
          className={`capitalize ${quiet ? "px-3 py-2 text-[12px]" : "px-2 py-0.5 text-[12px]"} ${
            theme === option
              ? /*
                 * Rose means "this needs you" on this board, and the login card
                 * has no accent at rest — so a permanently rose segment sitting
                 * under it would be the loudest thing on a page whose whole job
                 * is one tap. The state still separates by fill and weight, not
                 * by hue alone.
                 */
                quiet
                ? "bg-raise text-fg"
                : "bg-accent-dim text-accent"
              : "text-fg-quiet"
          }`}
        >
          {option}
        </button>
      ))}
    </span>
  )
}
