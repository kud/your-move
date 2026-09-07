/*
 * Which ground the app paints on, and the one place that knows the colours.
 *
 * `lib/views.ts` argues why a store is allowed on a board whose whole point is
 * derive-never-mirror, and the same argument covers this one: a theme is a
 * preference with no source of truth anywhere else, so there is nothing for it
 * to disagree with. An empty store means "follow the system", which is the
 * honest default rather than a degraded one.
 *
 * It lives here rather than in `@kud/gh-workflow` because there is nothing in
 * it the terminal surface could use — no meta tag, no `localStorage`, no
 * document root. Every line is browser transport.
 */

export type Theme = "auto" | "light" | "dark"

export const THEME = "ym:theme"

/*
 * The status bar has to follow the theme, or the "native" illusion breaks at
 * exactly the seam it was hardest to fix: an OS bar painted near-black above a
 * light page. `theme-color` is a meta rather than a stylesheet value, so it is
 * the one token that has to be set imperatively — which is precisely why these
 * two values must exist once. They are already spelled out in `layout.tsx`'s
 * viewport, its pre-paint script, `manifest.ts` and `--color-void`; a fifth
 * hand-written copy is how the page comes to flash the wrong ground for a
 * frame, which is the failure the whole pre-paint dance exists to prevent.
 */
export const GROUND: Record<"light" | "dark", string> = {
  dark: "#0b0c0e",
  light: "#f4f2f0",
}

export const resolveTheme = (theme: Theme): "light" | "dark" =>
  theme === "auto"
    ? matchMedia("(prefers-color-scheme: light)").matches
      ? "light"
      : "dark"
    : theme

export const paintChrome = (theme: Theme) => {
  const ground = GROUND[resolveTheme(theme)]
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", ground)
  document.documentElement.style.background = ground
}

/*
 * Read the result rather than the preference.
 *
 * `layout.tsx`'s pre-paint script has already resolved the stored value onto
 * the root before anything here runs, so the attribute is what is actually in
 * force. Going back to `localStorage` for it would show a control that
 * disagrees with the page it sits on for one frame — and on the login page,
 * whose whole quality is stillness, one frame is the entire budget.
 */
export const readTheme = (): Theme => {
  const set = document.documentElement.dataset.theme
  return set === "light" || set === "dark" || set === "auto" ? set : "auto"
}

/*
 * `sky.tsx` watches `data-theme` on the root with a MutationObserver, so the
 * attribute has to keep being written imperatively. Lifting theme into React
 * context on the way past would decouple the canvas silently.
 */
export const applyTheme = (next: Theme) => {
  document.documentElement.dataset.theme = next
  paintChrome(next)
  try {
    localStorage.setItem(THEME, next)
  } catch {
    /* Storage refused. The choice still holds for this page. */
  }
}
