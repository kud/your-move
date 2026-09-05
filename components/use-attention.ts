"use client"

import { useEffect } from "react"

/**
 * The tab itself is the notification.
 *
 * A count in the title and a marked favicon reach you in a background tab with
 * no daemon, no OS permission and nothing to install — which is most of what a
 * desktop notifier would have bought, at none of the cost.
 */
const icon = (marked: boolean) => {
  const dot = marked
    ? `<circle cx="24" cy="24" r="13" fill="#e0707c"/><rect x="22" y="16" width="4" height="10" rx="2" fill="#0b0c0e"/><rect x="22" y="29" width="4" height="4" rx="2" fill="#0b0c0e"/>`
    : `<circle cx="24" cy="24" r="12" fill="none" stroke="#6b7280" stroke-width="4"/>`

  return `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><rect width="48" height="48" rx="10" fill="#131519"/>${dot}</svg>`,
  )}`
}

export const useAttention = (count: number, label: string) => {
  useEffect(() => {
    document.title =
      count > 0 ? `(${count}) ${label} — needs you` : `${label} — co`

    const link =
      document.querySelector<HTMLLinkElement>("link[rel='icon']") ??
      document.head.appendChild(
        Object.assign(document.createElement("link"), { rel: "icon" }),
      )

    link.href = icon(count > 0)
  }, [count, label])
}
