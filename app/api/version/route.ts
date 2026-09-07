import { NextResponse } from "next/server"

/*
 * Which build is live right now.
 *
 * The client already knows which build IT is — `NEXT_PUBLIC_COMMIT` is baked in
 * at build time, so a page loaded three deployments ago still carries the commit
 * it was built from. This route returns the same constant from the CURRENT
 * deployment, so the two disagree exactly when the app on screen is stale.
 *
 * That comparison is the whole feature. An installed PWA resumed from the
 * background never re-requests its document, so it can hold a bundle for days
 * while quietly refreshing its data — the app looks alive and is old, which is
 * indistinguishable from a bug until someone thinks to check. Chasing one of
 * those cost an evening's twenty minutes.
 *
 * Outside the session gate on purpose: it says nothing about anybody, and a
 * stale client whose session has expired is exactly the one that most needs to
 * be told to reload.
 */

export const dynamic = "force-dynamic"

export const GET = () =>
  NextResponse.json(
    { commit: process.env.NEXT_PUBLIC_COMMIT ?? "" },
    { headers: { "Cache-Control": "no-store" } },
  )
