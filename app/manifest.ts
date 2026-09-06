import type { MetadataRoute } from "next"

/*
 * What the home screen learns about the board.
 *
 * `start_url: "/"` rather than a remembered path: the cockpit is a glance at
 * everything that moved, and landing straight on what needs you is
 * the one thing it should never do.
 *
 * The icons are PNGs under `/icons/` rather than Next's `app/icon.*` convention
 * because both this file and the icons must be readable *before* a session
 * exists — a browser fetches the manifest to decide whether the thing is
 * installable, and `middleware.ts` excludes exactly `manifest.webmanifest` and
 * `icons/`. Anything Next hashes into another path would 302 to the login page,
 * and an install prompt that never appears looks like a browser quirk rather
 * than a redirect.
 */
const manifest = (): MetadataRoute.Manifest => ({
  /*
   * A blank `name`, on purpose, and it is the only lever there is.
   *
   * Chrome's splash is painted before the page exists — no DOM, no CSS, nothing
   * of ours running — so its typeface is not ours to choose. What it prints IS
   * ours: it prints `name`. Blank, the splash is the mark alone, and the
   * wordmark arrives a moment later in our own serif, on our own shell, which
   * is the only place it can be set in the right face.
   *
   * `short_name` carries the launcher label, so the icon on the home screen is
   * unaffected. What this does cost is the install prompt's title, which is the
   * one other place Chrome reads `name` — a screen seen once per device.
   *
   * A NON-BREAKING space, and the distinction is the whole attempt. A plain
   * space is ASCII whitespace, which Chrome trims before deciding whether the
   * field is empty — so the first try almost certainly fell back to
   * `short_name` and printed the same word as before. `\u00A0` is not ASCII
   * whitespace, survives that trim as a non-empty string, and renders as
   * nothing.
   *
   * If this one also prints, the field is not the lever and there is no other:
   * revert to "Your Move" rather than trying a third character.
   */
  name: "\u00A0",
  short_name: "Your Move",
  description: "What moved on GitHub, and whose move it is.",
  start_url: "/",
  scope: "/",
  /*
   * A stable identity, independent of where the app happens to be served from.
   * Without it the install is keyed on `start_url`, so changing that — or
   * moving domain — orphans the installed copy and produces a second icon
   * rather than an update.
   */
  id: "/",
  display: "standalone",
  /* Chrome reads this first and falls back down the list, so a browser that
     ever drops `standalone` degrades to a chrome-less window rather than a
     tab. */
  display_override: ["standalone", "minimal-ui"],
  orientation: "portrait",
  /*
   * Both taken from `globals.css`. `background_color` paints the splash while
   * the app boots, so anything but the page's own ground reads as a flash.
   *
   * This is the ONLY splash. Chrome builds one from `name`, `background_color`
   * and the 512 icon, and holds it until the page can paint — so the app's own
   * launch screen, which we shipped and removed, could only ever arrive after
   * it and repeat the name without the mark. If one is ever wanted again, the
   * thing to change is these three fields, not a component.
   */
  background_color: "#0b0c0e",
  theme_color: "#0b0c0e",
  icons: [
    { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    /*
     * Android crops to whatever shape the launcher likes, so a maskable icon
     * has to bleed its ground to the edges and keep the mark inside the centre
     * 80%. Declaring the plain icon as maskable is the common mistake: the
     * launcher trusts it and shaves the mark.
     */
    {
      src: "/icons/icon-maskable-512.png",
      sizes: "512x512",
      type: "image/png",
      purpose: "maskable",
    },
  ],
})

export default manifest
