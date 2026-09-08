import type { Metadata, Viewport } from "next"
import type { ReactNode } from "react"

import { Leaving } from "@/components/leaving"
import { TooltipLayer } from "@/components/tooltip"
import { ServiceWorker } from "@/components/service-worker"

import "./globals.css"

/*
 * Where the card's own image is served from.
 *
 * An unfurler is not a browser: it fetches the HTML from somewhere else
 * entirely, so a relative `og:image` has no page to be relative TO and several
 * platforms drop it outright rather than guessing. Next needs an absolute base
 * to build one, and with none set it infers `localhost` off Vercel and warns at
 * build — a warning whose symptom is a preview that works for nobody.
 *
 * The README calls `move.kud.io` the REFERENCE deployment rather than the only
 * one, so it is the fallback and not the answer: a self-host that sets this
 * gets its own card, and one that does not still gets a working one.
 */
const site = process.env.NEXT_PUBLIC_SITE_URL ?? "https://move.kud.io"

export const metadata: Metadata = {
  metadataBase: new URL(site),
  title: "Your Move",
  description: "What moved on GitHub, and whose move it is.",
  /*
   * The link preview, which until now was three fallbacks in a trenchcoat: with
   * no `og:*` at all, every platform reached for the title, the description and
   * the favicon and drew the bare text strip Erwann screenshotted.
   *
   * `og:image` itself comes from `opengraph-image.png` beside this file — a
   * file convention, so Next hashes the URL, and emits the width, height and
   * type alongside it. Those three are not decoration: an unfurler that has to
   * download the image to learn its shape will often render the small card
   * while it waits, which is the thing being fixed.
   *
   * The card carries the mark and the wordmark and no words. The platform is
   * already drawing the title and the description next to it, so setting them
   * in the image too would say everything twice — and the obvious alternative,
   * a screenshot of a real board, is somebody's repository list.
   */
  openGraph: {
    type: "website",
    siteName: "Your Move",
    title: "Your Move",
    description: "What moved on GitHub, and whose move it is.",
    url: "/",
  },
  /*
   * Without this the card stays the small square form on X and everything that
   * copies its vocabulary, image or no image — the type is what promotes it,
   * not the presence of an image.
   *
   * There is deliberately no `twitter-image` file beside the OG one, and this
   * comment claimed the wrong reason until the built output was read: it is not
   * that `twitter:image` falls back to `og:image`, it is that Next emits
   * `twitter:image`, its alt, type and both dimensions from the SAME
   * `opengraph-image` file. A second PNG would be a second copy to keep in
   * step, bought for nothing.
   */
  twitter: {
    card: "summary_large_image",
  },
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
  <html lang="en" style={{ background: "#0b0c0e" }} suppressHydrationWarning>
    <head>
      {/*
        Before the first paint, and deliberately not in React.

        A theme read in an effect arrives after the page has already been
        painted in the other one — the flash of the wrong theme, which is the
        most conspicuous "this is a web page" tell there is. This runs while the
        parser is still in the head, so the class is on the element before a
        single pixel is drawn.
      */}
      <script
        dangerouslySetInnerHTML={{
          __html: `(function(){try{var t=localStorage.getItem("ym:theme")||"auto";var d=document.documentElement;d.dataset.theme=t;if(localStorage.getItem("ym:contrast")==="1")d.dataset.contrast="high";var mo=localStorage.getItem("ym:motion");if(mo==="1"||(mo===null&&matchMedia("(prefers-reduced-motion: reduce)").matches))d.dataset.motion="reduce";var light=t==="light"||(t==="auto"&&matchMedia("(prefers-color-scheme: light)").matches);var g=light?"#f4f2f0":"#0b0c0e";d.style.background=g;var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute("content",g);}catch(e){}})()`,
        }}
      />
    </head>
    <body>
      {children}
      <Leaving />
      <TooltipLayer />
      <ServiceWorker />
    </body>
  </html>
)

export default RootLayout
