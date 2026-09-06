"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import { Ago } from "@/components/ago"
import {
  COLUMNS,
  DONE,
  Swimlanes,
  sectionOf,
  shortName,
  type Lane,
} from "@/components/board"
import { RepoFilter, repoCounts } from "@/components/repo-filter"
import { Sky } from "@/components/sky"
import { useInbox, type Liveness } from "@/components/use-inbox"
import { presentationFor } from "@/lib/sections"
import type { Inbox as InboxData, Row } from "@/lib/github"

/*
 * The page around the board: header, honesty banners, filter, and the rail.
 *
 * The board itself lives in `board.tsx` in two compositions — a swimlane grid on
 * a desk, a vertical stack on a phone — because they are genuinely different
 * layouts rather than one layout at two widths, and pretending otherwise is what
 * produced the previous three attempts.
 */

const LIVENESS_TEXT: Record<Liveness, string> = {
  live: "Live",
  refreshing: "Refreshing",
  stale: "May be out of date",
  offline: "Offline",
  expired: "Session expired",
}

export const Inbox = ({ initial }: { initial?: InboxData }) => {
  const { inbox, liveness, refresh } = useInbox(initial)
  const [selected, setSelected] = useState<string[]>([])
  const [active, setActive] = useState<string>()
  const [folded, setFolded] = useState<Set<string>>(new Set())

  const scroller = useRef<HTMLDivElement>(null)
  const rail = useRef<HTMLElement>(null)
  const anchors = useRef(new Map<string, HTMLElement>())

  const register = useCallback((id: string, el: HTMLElement | null) => {
    if (el) anchors.current.set(id, el)
    else anchors.current.delete(id)
  }, [])

  /* Which projects are folded is a per-device convenience, not shared state:
     it belongs in this browser and nowhere else. */
  useEffect(() => {
    try {
      const saved = localStorage.getItem("ym:folded")
      if (saved) setFolded(new Set(JSON.parse(saved) as string[]))
    } catch {
      /* A private window, cleared site data, or storage refused outright — an
         unfolded board is the correct fallback and needs no explanation. */
    }
  }, [])

  const fold = useCallback((repo: string) => {
    setFolded((was) => {
      const next = new Set(was)
      if (next.has(repo)) next.delete(repo)
      else next.add(repo)
      try {
        localStorage.setItem("ym:folded", JSON.stringify([...next]))
      } catch {}
      return next
    })
  }, [])

  /* Restore a filter from the URL, so a filtered board is shareable and can be
     installed to a home screen as "my ambre board". */
  useEffect(() => {
    const repos = new URLSearchParams(location.search).get("repos")
    if (repos) setSelected(repos.split(",").filter(Boolean))
  }, [])

  useEffect(() => {
    const url = new URL(location.href)
    if (selected.length) url.searchParams.set("repos", selected.join(","))
    else url.searchParams.delete("repos")
    history.replaceState(null, "", url)
  }, [selected])

  const all = useMemo(() => inbox?.rows ?? [], [inbox])
  const repos = useMemo(() => repoCounts(all), [all])
  const filtering = selected.length > 0

  const shown = useMemo(
    () => (filtering ? all.filter((r) => selected.includes(r.repo)) : all),
    [all, selected, filtering],
  )

  /*
   * Lanes ordered by urgency: the projects that want you first. With the
   * horizontal axis now fixed furniture, this is the only ordering decision
   * left, and it stops a long list of projects burying the two that matter.
   * You still find a project by reading names down the left rather than by
   * remembering a position, which is what makes a moving order survivable.
   */
  const lanes = useMemo((): Lane[] => {
    const byRepo = new Map<string, Row[]>()
    for (const r of shown)
      byRepo.set(r.repo, [...(byRepo.get(r.repo) ?? []), r])

    return [...byRepo]
      .map(([repo, rows]): Lane => {
        const cells = new Map<string, Row[]>()
        for (const r of rows) {
          const key = sectionOf(r)
          cells.set(key, [...(cells.get(key) ?? []), r])
        }
        /* `you` first inside a cell, then most recently moved. */
        for (const [key, rs] of cells)
          cells.set(
            key,
            [...rs].sort(
              (a, b) =>
                Number(b.move === "you") - Number(a.move === "you") ||
                b.ts - a.ts,
            ),
          )

        return {
          repo,
          cells,
          total: rows.length,
          yours: rows.filter((r) => r.move === "you").length,
        }
      })
      .sort(
        (a, b) =>
          Number(b.yours > 0) - Number(a.yours > 0) ||
          b.yours - a.yours ||
          b.total - a.total,
      )
  }, [shown])

  /* Unfiltered totals, so a filtered board never narrows silently. */
  const totals = useMemo(() => {
    const map = new Map<string, number>()
    for (const r of all) map.set(sectionOf(r), (map.get(sectionOf(r)) ?? 0) + 1)
    return map
  }, [all])

  const shownTotals = useMemo(() => {
    const map = new Map<string, number>()
    for (const r of shown)
      map.set(sectionOf(r), (map.get(sectionOf(r)) ?? 0) + 1)
    return map
  }, [shown])

  /*
   * The active chip follows what is ON SCREEN, never what was last tapped. The
   * moment you swipe rather than tap, a last-tapped model is wrong and the rail
   * becomes a liar — worse than having no rail at all.
   */
  useEffect(() => {
    const root = scroller.current
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]
        const target = visible?.target
        const id =
          target?.getAttribute("data-column") ??
          target?.getAttribute("data-lane")
        if (id) setActive(id)
      },
      { root: root ?? null, threshold: [0.4, 0.8] },
    )

    for (const el of anchors.current.values()) observer.observe(el)
    return () => observer.disconnect()
  }, [lanes])

  /*
   * The rail follows the grid.
   *
   * Without this it shows the destination but never the journey: you swipe two
   * columns across and the highlight simply teleports, or worse sits on a chip
   * that has scrolled out of the rail entirely. Keeping the active chip in view
   * is what makes the rail read as a position indicator rather than a menu.
   *
   * scrollLeft rather than scrollIntoView on the chip: the latter walks up to
   * every scrollable ancestor, so it would drag the page as well as the rail.
   */
  useEffect(() => {
    const strip = rail.current
    if (!strip || !active) return

    const chip = strip.querySelector<HTMLElement>(`[data-chip="${active}"]`)
    if (!chip) return

    const target =
      chip.offsetLeft - (strip.clientWidth - chip.clientWidth) / 2

    strip.scrollTo({
      left: Math.max(0, target),
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
    })
  }, [active])

  const goTo = (id: string) =>
    anchors.current.get(id)?.scrollIntoView({
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
      inline: "start",
      block: "nearest",
    })

  const yoursTotal = shown.filter((r) => r.move === "you").length
  const hidden = all.length - shown.length
  const asOf = inbox ? new Date(inbox.fetchedAt).toISOString() : undefined
  const rateLimited = (inbox?.reasons ?? []).some((r) => /rate limit/i.test(r))
  const allFailed = Boolean(
    inbox && inbox.failed.length > 0 && all.length === 0,
  )
  const healthy = liveness === "live" || liveness === "refreshing"

  return (
    <>
      <Sky />

      <main className="relative z-10 mx-auto flex h-safe max-w-[1600px] flex-col px-3 pb-3 pt-3 md:px-6 md:pb-6 md:pt-8">
        <header className="flex items-center gap-2 pb-2 md:flex-wrap md:items-end md:gap-x-4 md:pb-3">
          <div className="min-w-0 flex-1">
            <h1 className="flex items-baseline gap-2 font-serif text-[19px] font-semibold leading-tight tracking-[-0.015em] md:text-[27px]">
              Your Move
              {/* Wide only: a baseline orients someone meeting the app for the
                  first time, and on his own phone he is never that reader. It
                  sits ON the title baseline rather than under it, so where it
                  does show it costs no vertical space. */}
              <span className="hidden truncate font-sans text-[13px] font-normal tracking-normal text-fg-quiet md:inline">
                what moved, and whose move it is
              </span>
            </h1>
            {/* Under the name rather than instead of it: it answers "what's on my
                board" better than a title that says less. A degraded state gets
                MORE space, not less. */}
            <p className="flex items-center gap-1.5 truncate text-[12px] text-fg-quiet md:font-mono md:text-[9.5px] md:uppercase md:tracking-[0.16em]">
              <span aria-hidden>
                {liveness === "live"
                  ? "●"
                  : liveness === "refreshing"
                    ? "◐"
                    : "◌"}
              </span>
              {healthy ? null : (
                <span className="text-brass">{LIVENESS_TEXT[liveness]} ·</span>
              )}
              {yoursTotal > 0 ? (
                <>
                  <b className="font-semibold text-accent">{yoursTotal}</b>
                  <span>need{yoursTotal === 1 ? "s" : ""} you</span>
                </>
              ) : (
                <span>nothing needs you</span>
              )}
              {lanes.length ? (
                <>
                  <span aria-hidden>·</span>
                  <span className="font-mono tabular-nums">
                    {lanes.length} {lanes.length === 1 ? "project" : "projects"}
                  </span>
                </>
              ) : null}
              {asOf ? (
                <>
                  <span aria-hidden>·</span>
                  <Ago iso={asOf} since={asOf} />
                </>
              ) : null}
              {inbox?.budget ? (
                <span
                  className="hidden font-mono tabular-nums md:inline"
                  title="GitHub GraphQL points left this hour"
                >
                  · {inbox.budget.remaining}
                </span>
              ) : null}
            </p>

          </div>

          <div className="flex shrink-0 items-center gap-1.5 md:ml-auto md:gap-2">
            <RepoFilter
              repos={repos}
              selected={selected}
              onChange={setSelected}
            />
            <button
              type="button"
              onClick={() => void refresh()}
              aria-label="Refresh"
              className="rounded-lg border border-line px-2 py-1 text-[13px] text-fg-mute hover:text-fg"
            >
              <span className="md:hidden" aria-hidden>
                ↻
              </span>
              <span className="hidden md:inline">Refresh</span>
            </button>
          </div>
        </header>

        {liveness === "expired" ? (
          <p className="mb-2 rounded-lg border border-brass p-3 text-[13px]">
            <span aria-hidden>! </span>
            Your GitHub session has expired.{" "}
            <a className="underline" href="/api/auth/login">
              Sign in again
            </a>
            .
          </p>
        ) : null}

        {inbox?.failed.length && !allFailed ? (
          <div className="mb-2 rounded-lg border border-brass p-2.5 text-[12px]">
            <p className="text-brass">
              <span aria-hidden>! </span>
              <strong>A source failed.</strong> An empty column below is missing
              data, not an empty status.
            </p>
            <details className="mt-1">
              <summary className="cursor-pointer text-fg-quiet">
                {inbox.failed.length} sections affected
              </summary>
              <p className="mt-1 text-fg-quiet">{inbox.failed.join(", ")}</p>
              {inbox.reasons?.length ? (
                <p className="mt-1 font-mono text-fg-quiet">
                  {inbox.reasons.join(" · ")}
                </p>
              ) : null}
            </details>
          </div>
        ) : null}

        {filtering ? (
          /* Takes layout rather than being a toast: the board must visibly be a
             smaller thing than the app, or a filtered board lies exactly the way
             a broken one does. */
          <div className="mb-2 flex flex-wrap items-center gap-2 rounded-lg border border-accent/50 bg-accent-dim px-2.5 py-1.5 text-[12.5px]">
            <span className="min-w-0 truncate">
              Filtered to {selected.map(shortName).join(", ")}
              {hidden > 0 ? ` · ${hidden} hidden` : ""}
            </span>
            <button
              type="button"
              onClick={() => setSelected([])}
              className="ml-auto shrink-0 text-accent hover:underline"
            >
              Clear
            </button>
          </div>
        ) : null}

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-line bg-panel shadow-[0_1px_0_rgba(255,255,255,.04)_inset,0_30px_80px_-40px_rgba(0,0,0,.9)]">
          {allFailed ? (
            /* One block, one fact, one way out. Redundancy reads as panic. */
            <div className="flex flex-col items-start gap-3 p-5">
              <p className="text-[15px] font-semibold text-brass">
                <span aria-hidden>! </span>
                {rateLimited
                  ? "GitHub's hourly budget is spent."
                  : "GitHub did not answer."}
              </p>
              <p className="max-w-[52ch] text-[13.5px] leading-[1.5] text-fg-mute">
                {rateLimited ? (
                  <>
                    This board is empty because nothing could be read, not
                    because nothing is waiting. The budget refills on its own
                    {inbox?.budget?.resetAt ? (
                      <>
                        {" "}
                        at{" "}
                        {new Date(inbox.budget.resetAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </>
                    ) : (
                      " within the hour"
                    )}
                    .
                  </>
                ) : (
                  "This board is empty because nothing could be read, not because nothing is waiting."
                )}
              </p>
              <button
                type="button"
                onClick={() => void refresh()}
                className="rounded-lg border border-line px-2.5 py-1 text-[13px] text-fg-mute hover:text-fg"
              >
                Try again
              </button>
            </div>
          ) : !inbox ? (
            <div className="flex flex-col gap-2 p-3">
              <div className="shimmer h-[76px] rounded-[9px] bg-panel-2" />
              <div className="shimmer h-[76px] rounded-[9px] bg-panel-2" />
              <div className="shimmer h-[76px] rounded-[9px] bg-panel-2" />
            </div>
          ) : lanes.length === 0 ? (
            /* The restful empty board. The section vocabulary survives here — it
               says what the board watches, without a grid of empty boxes. */
            <div className="flex flex-col items-start gap-3 p-6">
              <p className="text-[15px] text-fg">
                {filtering
                  ? "Nothing in the repositories you have selected."
                  : "Nothing is waiting on you."}
              </p>
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-[12.5px] text-fg-quiet">
                {COLUMNS.filter((s) => s !== DONE).map((s) => {
                  const p = presentationFor(s)
                  return (
                    <span key={s} className="flex items-center gap-1.5">
                      <span aria-hidden className="font-mono">
                        {p.glyph}
                      </span>
                      {p.title}
                    </span>
                  )
                })}
              </div>
            </div>
          ) : (
            <>
              {/*
               * The rail changes job by width, and above `md` it disappears:
               * the grid's own sticky column headers ARE the section rail, and
               * showing both would be the same information twice.
               *
               * On narrow it addresses the axis the stack keeps — projects.
               */}
              {/* The rail navigates the horizontal axis, which is the one a
                  narrow screen cannot show all of at once. */}
              <nav
                ref={rail}
                className="flex gap-1.5 overflow-x-auto border-b border-line-soft bg-panel px-2.5 py-1.5 md:hidden"
              >
                {COLUMNS.map((id) => {
                  const p = presentationFor(id)
                  const now = shownTotals.get(id) ?? 0
                  return (
                    <button
                      key={id}
                      type="button"
                      data-chip={id}
                      onClick={() => goTo(id)}
                      aria-label={p.title}
                      className={`flex shrink-0 items-center gap-1.5 rounded-lg border px-2 py-0.5 text-[12.5px] transition-colors ${
                        active === id
                          ? "border-accent bg-accent-dim text-fg"
                          : "border-line text-fg-mute"
                      }`}
                    >
                      <span aria-hidden className="font-mono">
                        {p.glyph}
                      </span>
                      <span>{p.title}</span>
                      <span className="font-mono tabular-nums text-fg-quiet">
                        {now}
                      </span>
                    </button>
                  )
                })}
              </nav>

              <div className="min-h-0 flex-1">
                <Swimlanes
                  lanes={lanes}
                  columns={COLUMNS}
                  counts={shownTotals}
                  onChanged={() => void refresh()}
                  register={register}
                  scroller={scroller}
                  folded={folded}
                  onFold={fold}
                />
              </div>
            </>
          )}
        </div>

        <footer className="mt-3 hidden shrink-0 border-t border-line pt-2 text-[12px] text-fg-quiet md:block">
          Read live from GitHub, cached for a minute. Nothing is stored; labels
          are the only thing written back.
        </footer>
      </main>
    </>
  )
}
