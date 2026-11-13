import type { ReactNode } from "react"

import { SupportLink } from "@/components/support-link"

/*
 * Who makes this and where to get help: one quiet line, on every page.
 *
 * The board passes its own notes in as children, so on a wide screen they share
 * the one rule with this line instead of stacking a second footer under it.
 * A `div` around the support link, never a `p`: the dialog renders beside the
 * link, and a dialog inside a paragraph is a hydration error.
 */
export const SiteFooter = ({
  children,
  className = "",
}: {
  children?: ReactNode
  className?: string
}) => (
  <footer
    className={`flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-fg-quiet ${className}`}
  >
    {children}
    <div className="whitespace-nowrap md:ml-auto">
      <a
        href="https://beansontoast.app"
        className="underline decoration-line underline-offset-2 hover:text-fg hover:decoration-accent"
      >
        beansontoast.app
      </a>
      <span aria-hidden className="mx-1.5">
        ·
      </span>
      <SupportLink />
    </div>
  </footer>
)
