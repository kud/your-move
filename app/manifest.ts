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
  name: "Your Move",
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
  /* Both taken from `globals.css`. `background_color` paints the splash while
     the app boots, so anything but the page's own ground reads as a flash. */
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
