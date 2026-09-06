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
          __html: `(function(){try{var t=localStorage.getItem("ym:theme")||"auto";var d=document.documentElement;d.dataset.theme=t;if(localStorage.getItem("ym:contrast")==="1")d.dataset.contrast="high";var light=t==="light"||(t==="auto"&&matchMedia("(prefers-color-scheme: light)").matches);var g=light?"#f4f2f0":"#0b0c0e";d.style.background=g;var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute("content",g);}catch(e){}})()`,
        }}
      />
    </head>
    <body>
      {children}
      <Splash />
      <ServiceWorker />
    </body>
  </html>
)

export default RootLayout
