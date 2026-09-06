"use client"

import { createContext, useContext, useEffect, useState } from "react"

/*
 * Which repos on the board you may actually write to.
 *
 * A context rather than a prop, and that is a judgement rather than a shortcut:
 * the only consumer is `RowLabels`, which sits four levels down through
 * `Swimlanes` → `Cell` → `Card`, and none of those three has any business
 * knowing about permissions. Threading it would put the word "writable" in
 * three components that do not use it.
 *
 * Unknown means writable. Every failure here — the request refused, storage
 * unavailable, a repo GitHub would not resolve — leaves the control exactly
 * where it was, and the server's own 403 is still the thing that actually stops
 * a write. This only ever removes a control it is sure about, so a broken
 * lookup costs nothing and a wrong one cannot lock you out of your own repo.
 */

const KEY = "ym:perms"

/* A permission changes when somebody is added to a repo. A day is far shorter
   than that and far longer than a session. */
const KEEP_MS = 24 * 60 * 60 * 1000

type Cache = { at: number; permissions: Record<string, string> }

const Writable = createContext<Set<string> | undefined>(undefined)

/** WRITE, MAINTAIN and ADMIN can label; READ and TRIAGE cannot. */
const canWrite = (permission: string) =>
  permission === "WRITE" || permission === "MAINTAIN" || permission === "ADMIN"

const read = (): Cache | undefined => {
  try {
    const saved = localStorage.getItem(KEY)
    if (!saved) return
    const cache = JSON.parse(saved) as Cache
    return Date.now() - cache.at < KEEP_MS ? cache : undefined
  } catch {
    return
  }
}

export const WritableRepos = ({
  repos,
  children,
}: {
  repos: string[]
  children: React.ReactNode
}) => {
  const [permissions, setPermissions] = useState<Record<string, string>>()

  /* Joined rather than passed as an array: the effect should re-run when the
     SET of repos changes, not every time the board re-renders one. */
  const key = [...repos].sort().join(",")

  useEffect(() => {
    if (!key) return

    const cached = read()
    const missing = key
      .split(",")
      .filter((repo) => !(cached?.permissions ?? {})[repo])

    if (!missing.length) return setPermissions(cached?.permissions)

    let live = true
    fetch(`/api/perms?repos=${encodeURIComponent(key)}`, { cache: "no-store" })
      .then((r) =>
        r.ok ? r.json() : Promise.reject(new Error(String(r.status))),
      )
      .then((body: { permissions: Record<string, string> }) => {
        if (!live) return
        setPermissions(body.permissions)
        try {
          localStorage.setItem(
            KEY,
            JSON.stringify({ at: Date.now(), permissions: body.permissions }),
          )
        } catch {}
      })
      .catch(() => {
        /* Unknown, which means writable. Nothing to say and nothing to show. */
      })

    return () => {
      live = false
    }
  }, [key])

  const writable = permissions
    ? new Set(
        Object.entries(permissions)
          .filter(([, permission]) => canWrite(permission))
          .map(([repo]) => repo),
      )
    : undefined

  return <Writable.Provider value={writable}>{children}</Writable.Provider>
}

/** True unless we positively know otherwise. */
export const useWritable = (repo: string) => {
  const writable = useContext(Writable)
  return !writable || writable.has(repo)
}
