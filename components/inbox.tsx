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
 * The columns are SECTIONS, and whose move it is rides on the card. `move` is a
 * property of a row rather than of a section — one column legitimately holds a
 * PR of yours with failing CI (yours) beside one out for review (theirs) — so
 * making it the container axis would shred sections across tiers. One axis for
 * space, one for emphasis.
 *
 * The column set is furniture: known, ordered, present. A set rebuilt from
 * whichever rows arrived is a groupBy wearing a board's clothes, and can build
 * neither the peripheral vision nor the spatial memory that justify columns.
 *
 * The exception, and it is not a contradiction: several ADJACENT empty sections
 * are ONE fact, and stating it three times is what makes output read as broken
 * rather than as a state. They collapse into a single tile that still names
 * every section it stands for.
 */

const TONE: Record<string, string> = {
  accent: "text-accent border-accent bg-accent-dim",
  brass: "text-brass border-brass/40 bg-brass/10",
  sage: "text-sage border-sage/40 bg-sage/10",
  slate: "text-slate border-line bg-panel-2",
}

/*
 * Order encodes the move axis: the sections that mostly produce "your move"
 * come first, so left-to-right is the priority read.
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

/*
 * Two bands on a phone, three from `md` up.
 *
 * The identity line is the band that earns least on a narrow screen — the column
 * already says which section, the filter usually says which owner, and `#123`
 * identifies nothing to a human. Dropping it and the rule under it takes a card
 * from ~120px to ~86px, which is the difference between three cards on screen
 * and five.
 */
const Card = ({ row, onChanged }: { row: Row; onChanged: () => void }) => {
  const section = presentationFor(sectionOf(row))
  const reason = reasonFor(row)
  const yours = row.move === "you"
  const shortRepo = row.repo.split("/").pop() ?? row.repo

  return (
    <article className="group relative rounded-[9px] border border-line bg-panel-2 p-2.5 transition-[background,border-color,transform] duration-150 hover:-translate-y-px hover:border-[#333941] hover:bg-raise md:p-3">
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
          className="line-clamp-2 text-pretty text-[15px] font-semibold leading-[1.4] text-fg hover:underline focus:underline focus:outline-none md:line-clamp-3 md:text-[15.5px] md:leading-[1.45]"
        >
          {row.title}
        </a>
      </div>

      {/* Band 2 — the identity. Wide only. */}
      <p className="mt-1.5 hidden font-mono text-[12.5px] text-fg-quiet md:block">
        {row.repo}#{row.number}
      </p>

      <RowLabels
        repo={row.repo}
        number={row.number}
        labels={row.labels ?? []}
        onChanged={onChanged}
      />

      {/* Band 3 — the state. No rule under two lines of text on a phone: a
          separator there is ceremony. */}
      <div className="mt-1.5 flex items-center gap-2 md:mt-2 md:border-t md:border-line-soft md:pt-2">
        <span
          className={`shrink-0 rounded border px-1.5 py-px text-[11px] ${
            yours
              ? (TONE[REASON_TONE[reason] ?? "slate"] ?? TONE.slate)
              : TONE.slate
          }`}
        >
          {reason}
        </span>
        <span className="truncate font-mono text-[12px] text-fg-quiet md:hidden">
          {shortRepo}
        </span>
        <span className="ml-auto shrink-0 font-mono text-[12.5px] tabular-nums text-fg-quiet">
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
      /* The ~14vw of the next column showing past 86vw is load-bearing: it is
         the only thing telling a first-time reader the board HAS more. Without
         it, a mandatory snap on a full-width column is a carousel. */
      className="flex w-[min(86vw,340px)] min-w-[min(86vw,340px)] flex-none snap-start flex-col bg-panel md:w-[320px] md:min-w-[320px]"
    >
      <header className="flex items-center gap-2 border-b border-line-soft p-2.5 md:p-3.5">
        <Slot glyph={p.glyph} tone={p.tone} />
        <h3 className="truncate text-[15px] font-semibold tracking-[-0.01em] md:text-[17px]">
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

      <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-2.5 md:gap-2.5 md:p-3">
        {state === "loading" ? (
          <>
            <div className="shimmer h-[86px] rounded-[9px] bg-panel-2" />
            <div className="shimmer h-[86px] rounded-[9px] bg-panel-2" />
          </>
        ) : (
          rows.map((row) => (
            <Card key={row.url} row={row} onChanged={onChanged} />
          ))
        )}
      </div>
    </section>
  )
}

/*
 * One tile standing for a run of adjacent quiet sections.
 *
 * Every section it covers is still named, still in order, and still reachable —
 * the rail chip snaps here, and the glyphs say which sections are accounted for.
 * What it refuses to do is state the same fact once per column.
 */
const QuietTile = ({
  ids,
  kind,
  register,
}: {
  ids: string[]
  kind: "clear" | "filtered"
  register: (id: string, el: HTMLElement | null) => void
}) => {
  const titles = ids.map((id) => presentationFor(id).title)
  const list =
    titles.length === 1
      ? titles[0]
      : `${titles.slice(0, -1).join(", ")} or ${titles.at(-1)}`

  return (
    <section
      ref={(el) => {
        for (const id of ids) register(id, el)
      }}
      data-column={ids[0]}
      className="flex w-[min(86vw,340px)] min-w-[min(86vw,340px)] flex-none snap-start flex-col justify-center gap-3 bg-panel p-5 md:w-[280px] md:min-w-[280px]"
    >
      <div className="flex flex-wrap gap-1.5">
        {ids.map((id) => {
          const p = presentationFor(id)
          return <Slot key={id} glyph={p.glyph} tone="slate" />
        })}
      </div>
      <p className="text-balance text-[13.5px] leading-[1.5] text-fg-quiet">
        {kind === "filtered"
          ? `Nothing in ${list} for the repositories you have selected.`
          : `Nothing in ${list}.`}
      </p>
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

    for (const el of new Set(columns.current.values())) observer.observe(el)
    return () => observer.disconnect()
  }, [inbox, selected])

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

  const stateOf = useCallback(
    (id: string): ColumnState => {
      if (!inbox) return "loading"
      if ((bySection.get(id) ?? []).length) return "rows"
      if (inbox.failed.length && !totals.get(id)) return "failed"
      return filtering && (totals.get(id) ?? 0) > 0 ? "filtered" : "clear"
    },
    [inbox, bySection, totals, filtering],
  )

  /*
   * Runs of adjacent quiet columns merge; anything with rows stands alone. This
   * is what stops six identical sentences reading as six failures.
   */
  const lanes = useMemo(() => {
    const out: (
      | { kind: "column"; id: string }
      | { kind: "quiet"; ids: string[]; empty: "clear" | "filtered" }
    )[] = []

    for (const id of ALL_COLUMNS) {
      const state = stateOf(id)
      if (state === "rows" || state === "loading") {
        out.push({ kind: "column", id })
        continue
      }
      const last = out.at(-1)
      const empty = state === "filtered" ? "filtered" : "clear"
      if (last?.kind === "quiet" && last.empty === empty) last.ids.push(id)
      else out.push({ kind: "quiet", ids: [id], empty })
    }
    return out
  }, [stateOf])

  const goTo = (id: string) =>
    columns.current.get(id)?.scrollIntoView({
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
      inline: "start",
      block: "nearest",
    })

  const yoursTotal = shown.filter((r) => r.move === "you").length
  const doneRows = bySection.get(DONE) ?? []
  const hidden = all.length - shown.length
  const asOf = inbox ? new Date(inbox.fetchedAt).toISOString() : undefined

  const rateLimited = (inbox?.reasons ?? []).some((r) => /rate limit/i.test(r))

  /*
   * Everything failed. That is ONE fact, so it is stated once — not as a banner
   * plus six columns each repeating it. Redundancy reads as panic.
   */
  const allFailed = Boolean(
    inbox && inbox.failed.length > 0 && all.length === 0,
  )
  const healthy = liveness === "live" || liveness === "refreshing"

  return (
    <>
      <Sky />

      <main className="relative z-10 mx-auto min-h-safe max-w-[1360px] px-3 pb-8 pt-3 md:px-6 md:pb-16 md:pt-8">
        <header className="flex items-center gap-2 pb-2 md:flex-wrap md:items-end md:gap-x-4 md:pb-3">
          <div className="min-w-0 flex-1">
            {/* On a phone this line IS the header: it answers "what's on my
                board" better than a title that says less. A degraded state gets
                MORE space, not less — the healthy one is the only one that can
                afford to be terse. */}
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
              {all.length ? (
                <>
                  <span aria-hidden>·</span>
                  <span className="font-mono tabular-nums">{all.length}</span>
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

            {/* An installed PWA already names itself in the icon and the title
                bar; spending 36px to say it twice is the easiest cut here. */}
            <h1 className="hidden font-serif text-[27px] font-semibold tracking-[-0.015em] md:block">
              Your Move
            </h1>
            <p className="hidden max-w-[58ch] text-[13.5px] text-fg-mute md:block">
              {yoursTotal === 0
                ? "Nothing is waiting on you."
                : "What moved, and whose move it is."}
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

        {/* Only when the failure is PARTIAL. Total failure is said once, below. */}
        {inbox?.failed.length && !allFailed ? (
          <div className="mb-2 rounded-lg border border-brass p-2.5 text-[12px]">
            <p className="text-brass">
              <span aria-hidden>! </span>
              <strong>A source failed.</strong> An empty column below is missing
              data, not an empty section.
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
              Filtered to {selected.join(", ")}
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

        <div className="overflow-hidden rounded-xl border border-line bg-panel shadow-[0_1px_0_rgba(255,255,255,.04)_inset,0_30px_80px_-40px_rgba(0,0,0,.9)]">
          {allFailed ? (
            /* One block, one fact, one way out. */
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
              {inbox?.reasons?.length ? (
                <p className="font-mono text-[12px] text-fg-quiet">
                  {inbox.reasons.join(" · ")}
                </p>
              ) : null}
              <button
                type="button"
                onClick={() => void refresh()}
                className="rounded-lg border border-line px-2.5 py-1 text-[13px] text-fg-mute hover:text-fg"
              >
                Try again
              </button>
            </div>
          ) : (
            <>
              {/* The rail answers "how much is in review" from any column, and
                  is also the navigation — a tap beats six swipes. Zero-count
                  chips stay: a map that hides what is empty is a lying map. */}
              <nav className="sticky top-0 z-10 flex gap-1.5 overflow-x-auto border-b border-line-soft bg-panel px-2.5 py-1.5">
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
                      className={`flex shrink-0 items-center gap-1.5 rounded-lg border px-2 py-0.5 text-[12.5px] transition-colors ${
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
                {lanes.map((lane) =>
                  lane.kind === "column" ? (
                    <Column
                      key={lane.id}
                      id={lane.id}
                      rows={bySection.get(lane.id) ?? []}
                      state={stateOf(lane.id)}
                      onChanged={() => void refresh()}
                      register={register}
                    />
                  ) : (
                    <QuietTile
                      key={lane.ids.join("+")}
                      ids={lane.ids}
                      kind={lane.empty}
                      register={register}
                    />
                  ),
                )}
              </div>
            </>
          )}
        </div>

        {/* A receipt, not a stage — and a collapsed strip nobody opens on a
            phone is the easiest cut on the page. */}
        {doneRows.length ? (
          <details className="mt-3 hidden rounded-xl border border-line bg-panel md:block">
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
                  <span className="font-mono text-[12.5px] text-fg-quiet">
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

        <footer className="mt-4 hidden border-t border-line pt-3 text-[12px] text-fg-quiet md:block">
          Read live from GitHub on every load. Nothing is stored; labels are the
          only thing written back.
        </footer>
      </main>
    </>
  )
}
