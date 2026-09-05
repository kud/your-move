"use client"

import { useCallback, useEffect, useState } from "react"

export type ViewMode = "side" | "centre" | "page"

export const VIEW_MODES: { mode: ViewMode; glyph: string; label: string }[] = [
  { mode: "side", glyph: "◨", label: "Side peek" },
  { mode: "centre", glyph: "▣", label: "Centre peek" },
  { mode: "page", glyph: "▭", label: "Full page" },
]

const KEY = "ym:view"

/*
 * Remembered between visits, but never read during render: localStorage does not
 * exist on the server, so the first client render has to match the "side"
 * default the server produced. The stored preference lands a tick later.
 */
export const useViewMode = () => {
  const [mode, setMode] = useState<ViewMode>("side")

  useEffect(() => {
    const stored = localStorage.getItem(KEY)
    if (stored === "side" || stored === "centre" || stored === "page")
      setMode(stored)
  }, [])

  const choose = useCallback((next: ViewMode) => {
    setMode(next)
    localStorage.setItem(KEY, next)
  }, [])

  return { mode, choose }
}
