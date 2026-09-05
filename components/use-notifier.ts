"use client"

import { useCallback, useEffect, useRef, useState } from "react"

/** Anything with a stable identity and something to announce. */
export type Notifiable = {
  repo: string
  number: number
  title: string
  url: string
}

export type Permission = "unsupported" | "default" | "granted" | "denied"

/* Keyed by repo, not company: numbers repeat across the repos the board
   aggregates, and a collision here silently swallows the notification. */
const keyOf = (row: Notifiable) => `${row.repo}#${row.number}`

/**
 * OS notifications, for when the tab is open but you are somewhere else.
 *
 * A secure context is required, which localhost and any https deployment both
 * satisfy, so this needs no certificate and no tunnel. The limit is real and worth knowing: nothing fires
 * once the browser is closed — that would take a service worker and a push
 * service, which is the standing infrastructure this deliberately does without.
 */
export const useNotifier = (attention: Notifiable[]) => {
  const [permission, setPermission] = useState<Permission>("unsupported")

  /* Notify on the edge, never the level: a row that still needs you is not
     news, and re-announcing it every poll is how a notifier gets muted. */
  const announced = useRef(new Set<string>())
  const primed = useRef(false)

  useEffect(() => {
    if (typeof Notification === "undefined") return setPermission("unsupported")
    setPermission(Notification.permission as Permission)
  }, [])

  const ask = useCallback(async () => {
    if (typeof Notification === "undefined") return
    setPermission((await Notification.requestPermission()) as Permission)
  }, [])

  useEffect(() => {
    if (permission !== "granted") return

    const current = new Set(attention.map(keyOf))

    /* The first pass after permission is granted only records what is already
       there. Otherwise turning notifications on fires one per open row. */
    if (!primed.current) {
      announced.current = current
      primed.current = true
      return
    }

    for (const row of attention) {
      const key = keyOf(row)
      if (announced.current.has(key)) continue

      const notice = new Notification(key, {
        body: row.title,
        tag: key,
      })
      notice.onclick = () => {
        window.focus()
        notice.close()
      }
    }

    /* Drop anything no longer needing you, so it can announce again if it comes back. */
    announced.current = current
  }, [attention, permission])

  return { permission, ask }
}
