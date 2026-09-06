"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import { Ago } from "@/components/ago"
import { RepoFilter, repoCounts } from "@/components/repo-filter"
import { RowLabels } from "@/components/row-labels"
import { Sky } from "@/components/sky"
import { useInbox, type Liveness } from "@/components/use-inbox"
import { presentationFor } from "@/lib/sections"
import type { Inbox as InboxData, Row } from "@/lib/github"

/*
 * A board: fixed columns, always drawn, scrolling sideways with snap.
 *
 * The columns are SECTIONS, and whose move it is rides on the card. An earlier
 * shape had it the other way round — `move` as the container, sections inside —
 * which shredded sections across two tiers, because `move` is a property of a
 * row rather than of a section: one column legitimately holds a PR of yours with
 * failing CI (yours) beside one out for review (theirs). One axis for space, one
 * for emphasis.
 *
 * The column set is furniture: known, ordered, present. A set rebuilt from
 * whichever rows arrived is a groupBy wearing a board's clothes, and can build
 * neither the peripheral vision nor the spatial memory that justify columns at
 * all. An empty column is information — "nothing awaits your review" answers the
 * question this board exists to ask.
 */

const TONE: Record<string, string> = {
  accent: "text-accent border-accent bg-accent-dim",
  brass: "text-brass border-brass/40 bg-brass/10",
  sage: "text-sage border-sage/40 bg-sage/10",
  slate: "text-slate border-line bg-panel-2",
}

/*
 * Order encodes the move axis: the sections that mostly produce "your move"
 * come first, so left-to-right is the priority read. The boundary between the
 * two blocks is marked in the rail, so the board is not six identical buckets.
 */
const YOURS_FIRST = ["review", "assigned", "open", "issues"] as const
const THEIRS = ["incoming", "reviewed"] as const
const ALL_COLUMNS: string[] = [...YOURS_FIRST, ...THEIRS]

/** `done` is a receipt, not a stage: nothing can ever move into it. */
const DONE = "done"

const SECTION_OF: Record<string, string> = {
  myPRs: "open",
  reviewRequests: "review",
  reviewed: "reviewed",
  assigned: "assigned",
  repoIssues: "issues",
  authoredIssues: "issues",
  repoPRs: "incoming",
  recentlyDone: DONE,
}

const sectionOf = (row: Row): string => SECTION_OF[row.source] ?? "open"

const REASON_TONE: Record<string, string> = {
  "CI failing": "accent",
  Conflict: "accent",
  "Changes requested": "brass",
  "Checks running": "brass",
  Approved: "sage",
  Merged: "sage",
}

/*
 * The one-word reason a row is in front of you. Without it a column of titles is
 * undifferentiated and the ordering reads as arbitrary.
 *
 * Issue-versus-PR comes from `kind`, which is the fact. It used to come from
 * comparing the section's GLYPH — a presentation token read as data, so the day
 * a glyph was re-lettered, issues would silently have started reading "Open".
 */
const reasonFor = (row: Row): string => {
  if (row.health === "ci-fail") return "CI failing"
  if (row.health === "conflict") return "Conflict"
  if (row.health === "changes-req") return "Changes requested"
  if (row.health === "threads") return `${row.unresolved} unresolved`
  if (row.source === "reviewRequests") return "Review requested"
  if (row.health === "approved") return "Approved"
  if (row.health === "draft") return "Draft"
  if (row.health === "merged") return "Merged"
  if (row.health === "closed") return "Closed"
  if (row.health === "pending") return "Checks running"
  return row.kind === "issue" ? "Issue" : "Open"
}

const LIVENESS_TEXT: Record<Liveness, string> = {
  live: "Live",
  refreshing: "Refreshing",
  stale: "May be out of date",
  offline: "Offline",
  expired: "Session expired",
}

const Slot = ({ glyph, tone }: { glyph: string; tone: string }) => (
  <span
    aria-hidden
    className={`grid size-5 shrink-0 place-items-center rounded-[5px] border font-mono text-[13.5px] leading-none ${TONE[tone] ?? TONE.slate}`}
  >
    {glyph}
  </span>
)

/*
 * What a section means, on demand. A native popover rather than `title=`,
 * because this board is mostly read on a phone where hover does not exist — and
 * it renders in the top layer, so the column's overflow cannot clip it.
 */
const About = ({
  id,
  title,
  meaning,
}: {
  id: string
  title: string
  meaning: string
}) => (
  <>
    <button
      type="button"
      popoverTarget={id}
      aria-label={`What "${title}" means`}
      className="grid size-5 shrink-0 place-items-center rounded-full border border-line bg-panel-2 font-mono text-[12px] leading-none text-fg-quiet transition-colors hover:border-accent hover:text-accent"
    >
      ?
    </button>
    <div
      id={id}
      popover="auto"
      className="m-auto max-w-[330px] rounded-xl border border-line bg-panel p-4 text-fg shadow-[0_30px_80px_-40px_rgba(0,0,0,.9)] backdrop:bg-black/60"
    >
      <b className="text-[15px] font-semibold">{title}</b>
      <p className="mt-2 text-[14px] leading-[1.55] text-fg-mute">{meaning}</p>
    </div>
  </>
)

const Card = ({ row, onChanged }: { row: Row; onChanged: () => void }) => {
  const section = presentationFor(sectionOf(row))
  const reason = reasonFor(row)
  const yours = row.move === "you"

  return (
    <article className="group relative rounded-[9px] border border-line bg-panel-2 p-3 transition-[background,border-color,transform] duration-150 hover:-translate-y-px hover:border-[#333941] hover:bg-raise">
      {/* Position and shape, not hue alone: a bar on the leading edge. */}
      {yours ? (
        <span
          aria-hidden
          className="absolute inset-y-2 left-0 w-[2px] rounded-full bg-accent"
        />
      ) : null}

      {/* Band 1 — the ask. The only thing here at full foreground. */}
      <div className="flex items-start gap-2">
        <Slot glyph={section.glyph} tone={yours ? section.tone : "slate"} />
        <a
          href={row.url}
          target="_blank"
          rel="noreferrer"
          className="line-clamp-3 text-pretty text-[15.5px] font-semibold leading-[1.45] text-fg hover:underline focus:underline focus:outline-none"
        >
          {row.title}
        </a>
      </div>

      {/* Band 2 — the identity. One string, not two spans and a dot. */}
      <p className="mt-1.5 font-mono text-[12.5px] text-fg-quiet">
        {row.repo}#{row.number}
      </p>

      <RowLabels
        repo={row.repo}
        number={row.number}
        labels={row.labels ?? []}
        onChanged={onChanged}
      />

      {/* Band 3 — the state. */}
      <div className="mt-2 flex items-center gap-2 border-t border-line-soft pt-2">
        <span
          className={`rounded border px-1.5 py-px text-[11px] ${
            yours
              ? (TONE[REASON_TONE[reason] ?? "slate"] ?? TONE.slate)
              : TONE.slate
          }`}
        >
          {reason}
        </span>
        <span className="ml-auto font-mono text-[12.5px] tabular-nums text-fg-quiet">
          {row.activityAge ?? row.age}
        </span>
      </div>
    </article>
  )
}

type ColumnState = "loading" | "clear" | "filtered" | "failed" | "rows"

const Column = ({
  id,
  rows,
  state,
  onChanged,
  register,
}: {
  id: string
  rows: Row[]
  state: ColumnState
  onChanged: () => void
  register: (id: string, el: HTMLElement | null) => void
}) => {
  const p = presentationFor(id)
  const yours = rows.filter((r) => r.move === "you").length

  return (
    <section
      ref={(el) => register(id, el)}
      data-column={id}
      /*
       * Snap on the column itself, not a wrapper — a wrapper would break the
       * gap-px-over-line-soft divider for nothing. An empty column is narrower:
       * you pass a dead region quickly, and the board's silhouette shows where
       * the work actually is before you read a word.
       *
       * The ~14vw of the next column showing past 86vw is load-bearing. It is
       * the only thing telling a first-time reader the board HAS more; without
       * it, a mandatory snap on a full-width column is a carousel.
       */
      className={`flex flex-none snap-start flex-col bg-panel ${
        state === "rows"
          ? "w-[min(86vw,340px)] min-w-[min(86vw,340px)] md:w-[320px] md:min-w-[320px]"
          : "w-[220px] min-w-[220px]"
      }`}
    >
      <header className="flex items-center gap-2 border-b border-line-soft p-3.5">
        <Slot glyph={p.glyph} tone={p.tone} />
        <h3 className="truncate text-[17px] font-semibold tracking-[-0.01em]">
          {p.title}
        </h3>
        <span className="ml-auto font-mono text-[13px] tabular-nums text-fg-quiet">
          {rows.length}
        </span>
        {yours ? (
          <span className="rounded-full border border-accent bg-accent-dim px-1.5 py-px text-[11px] text-accent">
            {yours} you
          </span>
        ) : null}
        <About id={`about-${id}`} title={p.title} meaning={p.meaning} />
      </header>

      <div className="flex flex-1 flex-col gap-2.5 overflow-y-auto p-3">
        {state === "loading" ? (
          <>
            <div className="shimmer h-[86px] rounded-[9px] bg-panel-2" />
            <div className="shimmer h-[86px] rounded-[9px] bg-panel-2" />
          </>
        ) : state === "failed" ? (
          <p className="m-auto max-w-[180px] text-balance text-center text-[13.5px] leading-[1.5] text-brass">
            <span aria-hidden>! </span>Could not read this section.
          </p>
        ) : state === "filtered" ? (
          <p className="m-auto max-w-[180px] text-balance text-center text-[13.5px] leading-[1.5] text-fg-quiet">
            Nothing here in the repositories you have selected.
          </p>
        ) : state === "clear" ? (
          /* The `empty` sentence is a claim about REALITY, so it may only appear
             when the board is actually showing all of reality. */
          <p className="m-auto max-w-[180px] text-balance text-center text-[13.5px] leading-[1.5] text-fg-quiet">
            {p.empty}
          </p>
        ) : (
          rows.map((row) => (
            <Card key={row.url} row={row} onChanged={onChanged} />
          ))
        )}
      </div>
    </section>
  )
}

export const Inbox = ({ initial }: { initial?: InboxData }) => {
  const { inbox, liveness, refresh } = useInbox(initial)
  const [selected, setSelected] = useState<string[]>([])
  const [active, setActive] = useState<string>(ALL_COLUMNS[0]!)

  const rowRef = useRef<HTMLDivElement>(null)
  const columns = useRef(new Map<string, HTMLElement>())

  const register = useCallback((id: string, el: HTMLElement | null) => {
    if (el) columns.current.set(id, el)
    else columns.current.delete(id)
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

  /*
   * The active chip follows what is ON SCREEN, never what was last tapped. The
   * moment you swipe rather than tap, a last-tapped model is wrong and the rail
   * becomes a liar — worse than having no rail at all.
   */
  useEffect(() => {
    const root = rowRef.current
    if (!root) return

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]
        const id = visible?.target.getAttribute("data-column")
        if (id) setActive(id)
      },
      { root, threshold: [0.5, 0.9] },
    )

    for (const el of columns.current.values()) observer.observe(el)
    return () => observer.disconnect()
  }, [inbox])

  const all = useMemo(() => inbox?.rows ?? [], [inbox])
  const repos = useMemo(() => repoCounts(all), [all])
  const filtering = selected.length > 0

  const shown = useMemo(
    () => (filtering ? all.filter((r) => selected.includes(r.repo)) : all),
    [all, selected, filtering],
  )

  const bySection = useMemo(() => {
    const map = new Map<string, Row[]>()
    for (const r of shown) {
      const key = sectionOf(r)
      map.set(key, [...(map.get(key) ?? []), r])
    }
    /* `you` first inside each column: the order carries the emphasis. */
    for (const [key, rs] of map)
      map.set(
        key,
        [...rs].sort(
          (a, b) => Number(b.move === "you") - Number(a.move === "you"),
        ),
      )
    return map
  }, [shown])

  /* Unfiltered totals, so the rail can show `2/9` and never narrow silently. */
  const totals = useMemo(() => {
    const map = new Map<string, number>()
    for (const r of all) map.set(sectionOf(r), (map.get(sectionOf(r)) ?? 0) + 1)
    return map
  }, [all])

  const goTo = (id: string) =>
    columns.current.get(id)?.scrollIntoView({
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
      inline: "start",
      block: "nearest",
    })

  const stateOf = (id: string): ColumnState => {
    if (!inbox) return "loading"
    if ((bySection.get(id) ?? []).length) return "rows"
    if (inbox.failed.length && !totals.get(id)) return "failed"
    return filtering && (totals.get(id) ?? 0) > 0 ? "filtered" : "clear"
  }

  const yoursTotal = shown.filter((r) => r.move === "you").length
  const doneRows = bySection.get(DONE) ?? []
  const hidden = all.length - shown.length
  const asOf = inbox ? new Date(inbox.fetchedAt).toISOString() : undefined

  /* Running out of GitHub budget is not "a source failed" — it is a specific,
     self-inflicted, self-healing condition, and saying so beats a generic
     warning that sends you looking at GitHub status pages. */
  const rateLimited = (inbox?.reasons ?? []).some((r) =>
    /rate limit/i.test(r),
  )

  return (
    <>
      <Sky />

      <main className="relative z-10 mx-auto min-h-safe max-w-[1360px] px-6 pb-16 pt-8">
        <header className="flex flex-wrap items-end gap-x-4 gap-y-2 pb-4">
          <div className="min-w-0">
            <p className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-fg-quiet">
              {yoursTotal === 0
                ? "nothing needs you"
                : `${yoursTotal} ${yoursTotal === 1 ? "thing needs" : "things need"} you`}
              {asOf ? " · as of " : ""}
              {asOf ? <Ago iso={asOf} since={asOf} /> : null}
            </p>
            <h1 className="font-serif text-[27px] font-semibold tracking-[-0.015em]">
              Your Move
            </h1>
            <p className="max-w-[58ch] text-[13.5px] text-fg-mute">
              {yoursTotal === 0
                ? "Nothing is waiting on you."
                : "What moved, and whose move it is."}
            </p>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <p className="flex items-center gap-1.5 text-[12px] text-fg-quiet">
              <span aria-hidden>
                {liveness === "live"
                  ? "●"
                  : liveness === "refreshing"
                    ? "◐"
                    : "◌"}
              </span>
              <span>{LIVENESS_TEXT[liveness]}</span>
              {inbox?.budget ? (
                <span
                  className="font-mono tabular-nums"
                  title="GitHub GraphQL points left this hour"
                >
                  · {inbox.budget.remaining}
                </span>
              ) : null}
            </p>
            <RepoFilter
              repos={repos}
              selected={selected}
              onChange={setSelected}
            />
            <button
              type="button"
              onClick={() => void refresh()}
              className="rounded-lg border border-line px-2.5 py-1 text-[13px] text-fg-mute hover:text-fg"
            >
              Refresh
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

        {inbox?.failed.length ? (
          /* A partial answer is worth rendering, but never silently: an empty
             board and a broken one are otherwise the same picture. */
          <div className="mb-2 rounded-lg border border-brass p-3 text-[12px]">
            <p className="text-brass">
              <span aria-hidden>! </span>
              {rateLimited ? (
                <>
                  <strong>GitHub&rsquo;s hourly budget is spent.</strong> The
                  board below is missing data, not empty. It refills on its own
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
                <>
                  <strong>A source failed.</strong> An empty board below is
                  missing data, not an empty inbox.
                </>
              )}
            </p>
            <p className="mt-1 text-fg-quiet">
              Did not answer: {inbox.failed.join(", ")}
            </p>
            {inbox.reasons?.length ? (
              <p className="mt-1 font-mono text-fg-quiet">
                {inbox.reasons.join(" · ")}
              </p>
            ) : null}
          </div>
        ) : null}

        {filtering ? (
          /* Takes layout rather than being a toast: the board must visibly be a
             smaller thing than the app, or a filtered board lies exactly the way
             a broken one does. */
          <div className="mb-2 flex flex-wrap items-center gap-2 rounded-lg border border-accent/50 bg-accent-dim px-3 py-2 text-[12.5px]">
            <span>
              Filtered to {selected.join(", ")}
              {hidden > 0 ? ` · ${hidden} rows hidden` : ""}
            </span>
            <button
              type="button"
              onClick={() => setSelected([])}
              className="ml-auto text-accent hover:underline"
            >
              Clear
            </button>
          </div>
        ) : null}

        <div className="overflow-hidden rounded-xl border border-line bg-panel shadow-[0_1px_0_rgba(255,255,255,.04)_inset,0_30px_80px_-40px_rgba(0,0,0,.9)]">
          {/* The rail answers "how much is in review" from any column, and is
              also the navigation — a tap beats six swipes. */}
          <nav className="sticky top-0 z-10 flex gap-1.5 overflow-x-auto border-b border-line-soft bg-panel px-3 py-2">
            {ALL_COLUMNS.map((id, i) => {
              const p = presentationFor(id)
              const total = totals.get(id) ?? 0
              const now = (bySection.get(id) ?? []).length
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => goTo(id)}
                  aria-label={p.title}
                  className={`flex shrink-0 items-center gap-1.5 rounded-lg border px-2 py-1 text-[12.5px] transition-colors ${
                    active === id
                      ? "border-accent bg-accent-dim text-fg"
                      : "border-line text-fg-mute"
                  } ${i === YOURS_FIRST.length ? "ml-3" : ""}`}
                >
                  <span aria-hidden className="font-mono">
                    {p.glyph}
                  </span>
                  <span className="hidden md:inline">{p.title}</span>
                  <span className="font-mono tabular-nums text-fg-quiet">
                    {filtering ? `${now}/${total}` : total}
                  </span>
                </button>
              )
            })}
          </nav>

          <div
            ref={rowRef}
            className="h-board flex snap-x snap-mandatory gap-px overflow-x-auto overscroll-x-contain bg-line-soft md:snap-proximity"
          >
            {ALL_COLUMNS.map((id) => (
              <Column
                key={id}
                id={id}
                rows={bySection.get(id) ?? []}
                state={stateOf(id)}
                onChanged={() => void refresh()}
                register={register}
              />
            ))}
          </div>
        </div>

        {/* A receipt, not a stage: nothing can move into it — items simply
            appear, already finished. */}
        {doneRows.length ? (
          <details className="mt-4 rounded-xl border border-line bg-panel">
            <summary className="cursor-pointer px-3.5 py-2.5 text-[13px] text-fg-mute">
              <span aria-hidden>{presentationFor(DONE).glyph} </span>
              Recently done{" "}
              <span className="font-mono tabular-nums text-fg-quiet">
                {doneRows.length}
              </span>
            </summary>
            <div className="divide-y divide-line-soft border-t border-line-soft">
              {doneRows.map((r) => (
                <a
                  key={r.url}
                  href={r.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2.5 px-3.5 py-2.5 hover:bg-raise"
                >
                  <span className="min-w-0 flex-1 truncate text-[14.5px]">
                    {r.title}
                  </span>
                  <span className="hidden font-mono text-[12.5px] text-fg-quiet md:inline">
                    {r.repo}#{r.number}
                  </span>
                  <span className="font-mono text-[12.5px] tabular-nums text-fg-quiet">
                    {r.age}
                  </span>
                  <span aria-label="Opens on GitHub" className="text-fg-quiet">
                    ↗
                  </span>
                </a>
              ))}
            </div>
          </details>
        ) : null}

        <footer className="mt-4 border-t border-line pt-3 text-[12px] text-fg-quiet">
          Read live from GitHub on every load. Nothing is stored; labels are the
          only thing written back.
        </footer>
      </main>
    </>
  )
}
