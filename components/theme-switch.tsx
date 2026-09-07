"use client"

import { useEffect, useState, type ReactNode } from "react"

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

/*
 * Drawn, not typed — the same rule `section-mark.tsx` records: a text glyph's
 * size and vertical placement are whatever the installed font decides, and on
 * Android three of those marks were being drawn by a fallback face. Same 12
 * viewBox and 1.25 stroke as the filter and section marks, so these read as
 * more of one icon set rather than as a second.
 *
 * A prefix, never a replacement. Icon-only is the version that cannot be
 * honest here: `auto` has no icon of its own, and drawing it as a moon because
 * it happens to be night states the resolved value as if it were the setting.
 * The word stays; the glyph is there to be found at a glance.
 */
const MARK: Record<Theme, ReactNode> = {
  /* Half-filled: following something rather than being something. */
  auto: (
    <>
      <circle cx="6" cy="6" r="4.2" />
      <path d="M6 1.8a4.2 4.2 0 0 0 0 8.4z" fill="currentColor" stroke="none" />
    </>
  ),
  light: (
    <>
      <circle cx="6" cy="6" r="2.4" />
      <path d="M6 1v1.1M6 9.9V11M11 6H9.9M2.1 6H1M9.54 2.46l-.78.78M3.24 8.76l-.78.78M9.54 9.54l-.78-.78M3.24 3.24l-.78-.78" />
    </>
  ),
  dark: <path d="M9.6 7.2A4.2 4.2 0 0 1 4.8 2.4a4.2 4.2 0 1 0 4.8 4.8z" />,
}

const Mark = ({ theme }: { theme: Theme }) => (
  <svg
    viewBox="0 0 12 12"
    aria-hidden
    fill="none"
    stroke="currentColor"
    strokeWidth="1.25"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="size-3 shrink-0"
  >
    {MARK[theme]}
  </svg>
)

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
          className={`flex items-center gap-1.5 capitalize ${quiet ? "px-3 py-2 text-[12px]" : "px-2 py-0.5 text-[12px]"} ${
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
          <Mark theme={option} />
          {option}
        </button>
      ))}
    </span>
  )
}
