import type { Metadata, Viewport } from "next"
import type { ReactNode } from "react"

import { ServiceWorker } from "@/components/service-worker"
import { Splash } from "@/components/splash"

import "./globals.css"

export const metadata: Metadata = {
  title: "Your Move",
  description: "What moved on GitHub, and whose move it is.",
  /*
   * iOS ignores the manifest's icons for a home-screen install and reads this
   * instead, so an icon declared only in the manifest gets a screenshot of the
   * page in its place on the one device this was built for.
   */
  appleWebApp: {
    capable: true,
    title: "Your Move",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/apple-touch-icon.png",
  },
}

export const viewport: Viewport = {
  /* Matches the manifest and `--color-void`: this tints the status bar and the
     address bar, and a default there frames a near-black page in white. */
  themeColor: "#0b0c0e",
  /* Full-bleed under the notch, which is only safe because `globals.css` pays
     the safe-area insets back where content would otherwise sit under it. */
  viewportFit: "cover",
  /*
   * As a META, not the CSS rule in `globals.css` — that one arrives too late.
   *
   * A browser paints its canvas before it has parsed any stylesheet, and its
   * default canvas is white. So launching the installed app flashed white for
   * one frame between the OS splash and the first paint, which is the single
   * most "this is a web page" thing the app did. Declared here it is known from
   * the head, before a byte of CSS is read.
   */
  colorScheme: "dark",
}

const RootLayout = ({ children }: { children: ReactNode }) => (
  /* The inline background is the same argument one step further: it needs no
     stylesheet at all, so there is no frame in which it is not applied. */
  <html lang="en" style={{ background: "#0b0c0e" }}>
    <body>
      {children}
      <Splash />
      <ServiceWorker />
    </body>
  </html>
)

export default RootLayout
