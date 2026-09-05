"use client"

import { useEffect, useState } from "react"

import { ago } from "@/lib/time"

/*
 * A relative timestamp that survives hydration.
 *
 * `ago()` reads the clock, so calling it during render makes the server and the
 * client disagree by however long the round trip took — React reports that as a
 * hydration failure and throws the tree away. The rule is that the client's
 * FIRST render must match the server's exactly; only afterwards may it diverge.
 *
 * So the first paint uses `since`, the server's own timestamp, which both sides
 * hold. The effect then switches to the live clock and keeps ticking, which is
 * also why these times move between stream events instead of freezing until the
 * next push.
 */
export const Ago = ({ iso, since }: { iso: string | null; since: string }) => {
  const [now, setNow] = useState(() => new Date(since).getTime())

  useEffect(() => {
    const tick = () => setNow(Date.now())
    tick()
    const timer = setInterval(tick, 1000)
    return () => clearInterval(timer)
  }, [])

  return <>{ago(iso, now)}</>
}
