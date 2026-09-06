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
 * A board whose columns are REPOSITORIES.
 *
 * Two earlier axes were wrong for the same underlying reason. `move` as the
 * container shredded sections, because whose move it is belongs to a row. Then
 * sections as columns turned out to be partly redundant with the card itself —
 * a column headed "Review requested" over cards whose chips say "Review
 * requested" states the same thing twice — and, worse, sections are a vocabulary
 * you have to learn while `kud/ambre` means something before you read a word.
 *
 * The fixed-furniture argument that justified section columns does not transfer,
 * because of one asymmetry: an empty SECTION is information ("nothing awaits
 * your review" answers a question), while an empty REPO is the default state of
 * two hundred repositories. So repo columns simply do not render when empty.
 *
 * The section axis is not lost — it rotates. Vertical, inside a column, as
 * sticky sub-headers, which is where a list of mixed things wants its structure.
 */

const TONE: Record<string, string> = {
  accent: "text-accent border-accent bg-accent-dim",
  brass: "text-brass border-brass/40 bg-brass/10",
  sage: "text-sage border-sage/40 bg-sage/10",
  slate: "text-slate border-line bg-panel-2",
}

/** The vertical order inside a column. `done` last: it is what already happened. */
const SECTION_ORDER = [
  "review",
  "assigned",
  "open",
  "issues",
  "incoming",
  "reviewed",
  "done",
]

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

/*
 * Sub-headers earn their place only once a column is mixed enough to need them.
 * At about five rows they would outweigh the content, and the reason chips
 * already carry the kind.
 */
const SUBHEADERS_ABOVE_ROWS = 6
const SUBHEADERS_ABOVE_SECTIONS = 2

/** A day of closing ten things must not bury the live work. */
const DONE_PER_REPO = 3

const REASON_TONE: Record<string, string> = {
  "CI failing": "accent",
  Conflict: "accent",
  "Changes requested": "brass",
  "Checks running": "brass",
  Approved: "sage",
  Merged: "sage",
}

/*
 * The one-word reason a row is in front of you.
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

const shortName = (repo: string) => repo.split("/").pop() ?? repo

const Slot = ({ glyph, tone }: { glyph: string; tone: string }) => (
  <span
    aria-hidden
    className={`grid size-5 shrink-0 place-items-center rounded-[5px] border font-mono text-[13.5px] leading-none ${TONE[tone] ?? TONE.slate}`}
  >
    {glyph}
  </span>
)

/*
 * Two bands on a phone, three from `md` up. The identity line earns least on a
 * narrow screen — and on a repo board it earns even less, because the column
 * header already says which repository this is.
 */
const Card = ({ row, onChanged }: { row: Row; onChanged: () => void }) => {
  const section = presentationFor(sectionOf(row))
  const reason = reasonFor(row)
  const yours = row.move === "you"

  return (
    <article className="group relative rounded-[9px] border border-line bg-panel-2 p-2.5 transition-[background,border-color,transform] duration-150 hover:-translate-y-px hover:border-[#333941] hover:bg-raise md:p-3">
      {/* Position and shape, not hue alone: a bar on the leading edge. */}
      {yours ? (
        <span
          aria-hidden
          className="absolute inset-y-2 left-0 w-[2px] rounded-full bg-accent"
        />
      ) : null}

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

      <RowLabels
        repo={row.repo}
        number={row.number}
        labels={row.labels ?? []}
        onChanged={onChanged}
      />

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
        <span className="hidden font-mono text-[12px] text-fg-quiet md:inline">
          #{row.number}
        </span>
        <span className="ml-auto shrink-0 font-mono text-[12.5px] tabular-nums text-fg-quiet">
          {row.activityAge ?? row.age}
        </span>
      </div>
    </article>
  )
}

/** Recently closed, as part of a project's story rather than a page region. */
const DoneRow = ({ row }: { row: Row }) => (
  <a
    href={row.url}
    target="_blank"
    rel="noreferrer"
    className="flex items-center gap-2 px-1 py-1 text-[12.5px] text-fg-quiet hover:text-fg-mute"
  >
    <span aria-hidden className="text-sage">
      ✓
    </span>
    <span className="min-w-0 flex-1 truncate">{row.title}</span>
    <span className="shrink-0 font-mono tabular-nums">{row.age}</span>
  </a>
)

type RepoLane = {
  repo: string
  rows: Row[]
  yours: number
  groups: [string, Row[]][]
  done: Row[]
}

const Column = ({
  lane,
  onChanged,
  register,
}: {
  lane: RepoLane
  onChanged: () => void
  register: (id: string, el: HTMLElement | null) => void
}) => {
  const subheaders =
    lane.rows.length > SUBHEADERS_ABOVE_ROWS ||
    lane.groups.length > SUBHEADERS_ABOVE_SECTIONS

  return (
    <section
      ref={(el) => register(lane.repo, el)}
      data-column={lane.repo}
      /* The ~14vw of the next column showing past 86vw is load-bearing: it is
         the only thing telling a first-time reader the board HAS more. */
      className="flex w-[min(86vw,340px)] min-w-[min(86vw,340px)] flex-none snap-start flex-col bg-panel md:w-[320px] md:min-w-[320px]"
    >
      <header className="flex items-center gap-2 border-b border-line-soft p-2.5 md:p-3.5">
        <h3 className="min-w-0 flex-1 truncate text-[15px] font-semibold tracking-[-0.01em] md:text-[17px]">
          {shortName(lane.repo)}
        </h3>
        <span className="font-mono text-[13px] tabular-nums text-fg-quiet">
          {lane.rows.length}
        </span>
        {/* "Does this project want me" answerable from the header alone. */}
        {lane.yours ? (
          <span className="shrink-0 rounded-full border border-accent bg-accent-dim px-1.5 py-px text-[11px] text-accent">
            {lane.yours} you
          </span>
        ) : null}
      </header>

      <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-2.5 md:gap-2.5 md:p-3">
        {lane.groups.map(([section, rows]) => {
          const p = presentationFor(section)
          return (
            <div key={section} className="flex flex-col gap-2 md:gap-2.5">
              {subheaders ? (
                <p className="sticky top-0 z-10 -mx-2.5 flex items-center gap-1.5 bg-panel px-2.5 py-1 font-mono text-[11px] uppercase tracking-[0.08em] text-fg-quiet md:-mx-3 md:px-3">
                  <span aria-hidden>{p.glyph}</span>
                  <span>{p.title}</span>
                  <span className="tabular-nums">{rows.length}</span>
                </p>
              ) : null}
              {rows.map((row) => (
                <Card key={row.url} row={row} onChanged={onChanged} />
              ))}
            </div>
          )
        })}

        {lane.done.length ? (
          <div className="mt-1 border-t border-line-soft pt-1.5">
            {lane.done.slice(0, DONE_PER_REPO).map((row) => (
              <DoneRow key={row.url} row={row} />
            ))}
          </div>
        ) : null}
      </div>
    </section>
  )
}

export const Inbox = ({ initial }: { initial?: InboxData }) => {
  const { inbox, liveness, refresh } = useInbox(initial)
  const [selected, setSelected] = useState<string[]>([])
  const [active, setActive] = useState<string>()

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

  const all = useMemo(() => inbox?.rows ?? [], [inbox])
  const repos = useMemo(() => repoCounts(all), [all])
  const filtering = selected.length > 0

  const shown = useMemo(
    () => (filtering ? all.filter((r) => selected.includes(r.repo)) : all),
    [all, selected, filtering],
  )

  /*
   * Columns ordered by urgency, and this is what makes fifteen of them
   * survivable: you never reach column twelve, because column twelve is by
   * construction the quietest thing you own. Semantic position replaces the
   * spatial memory that a fixed set would have given — and at fifteen columns
   * nobody was going to remember positions anyway.
   */
  const lanes = useMemo((): RepoLane[] => {
    const byRepo = new Map<string, Row[]>()
    for (const r of shown)
      byRepo.set(r.repo, [...(byRepo.get(r.repo) ?? []), r])

    return (
      [...byRepo]
        .map(([repo, rows]): RepoLane => {
          const live = rows.filter((r) => sectionOf(r) !== DONE)
          const done = rows
            .filter((r) => sectionOf(r) === DONE)
            .sort((a, b) => b.ts - a.ts)

          const grouped = new Map<string, Row[]>()
          for (const r of live)
            grouped.set(sectionOf(r), [...(grouped.get(sectionOf(r)) ?? []), r])

          const groups = SECTION_ORDER.filter((s) => grouped.has(s)).map(
            (s): [string, Row[]] => [
              s,
              [...grouped.get(s)!].sort(
                (a, b) =>
                  Number(b.move === "you") - Number(a.move === "you") ||
                  b.ts - a.ts,
              ),
            ],
          )

          return {
            repo,
            rows: live,
            yours: live.filter((r) => r.move === "you").length,
            groups,
            done,
          }
        })
        /* A repo with nothing live and nothing done is not a column. */
        .filter((lane) => lane.rows.length || lane.done.length)
        .sort(
          (a, b) =>
            Number(b.yours > 0) - Number(a.yours > 0) ||
            b.yours - a.yours ||
            Math.max(...b.rows.map((r) => r.ts), 0) -
              Math.max(...a.rows.map((r) => r.ts), 0),
        )
    )
  }, [shown])

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
  }, [lanes])

  const goTo = (repo: string) =>
    columns.current.get(repo)?.scrollIntoView({
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

  /* Everything failed. One fact, stated once — not a banner plus a column each
     repeating it. Redundancy reads as panic. */
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

        {inbox?.failed.length && !allFailed ? (
          <div className="mb-2 rounded-lg border border-brass p-2.5 text-[12px]">
            <p className="text-brass">
              <span aria-hidden>! </span>
              <strong>A source failed.</strong> A project missing below is
              missing data, not idle.
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
             smaller thing than the app. On a repo board this reads especially
             well — filtering simply removes columns. */
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

        <div className="overflow-hidden rounded-xl border border-line bg-panel shadow-[0_1px_0_rgba(255,255,255,.04)_inset,0_30px_80px_-40px_rgba(0,0,0,.9)]">
          {allFailed ? (
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
          ) : !inbox ? (
            <div className="flex gap-px bg-line-soft">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="flex w-[min(86vw,340px)] flex-none flex-col gap-2 bg-panel p-3 md:w-[320px]"
                >
                  <div className="shimmer h-[86px] rounded-[9px] bg-panel-2" />
                  <div className="shimmer h-[86px] rounded-[9px] bg-panel-2" />
                </div>
              ))}
            </div>
          ) : lanes.length === 0 ? (
            /* The restful empty board. The section vocabulary survives here —
               it says what the board watches, without six columns of prose. */
            <div className="flex flex-col items-start gap-3 p-6">
              <p className="text-[15px] text-fg">
                {filtering
                  ? "Nothing in the repositories you have selected."
                  : "Nothing is waiting on you."}
              </p>
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-[12.5px] text-fg-quiet">
                {SECTION_ORDER.filter((s) => s !== DONE).map((s) => {
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
              {/* With a column per project the rail stops being a nicety and
                  becomes the navigation. It shares the urgency order, so the
                  projects that want you are at the left end, already on screen
                  — fifteen chips need not fit, the first four do. */}
              <nav className="sticky top-0 z-10 flex gap-1.5 overflow-x-auto border-b border-line-soft bg-panel px-2.5 py-1.5">
                {lanes.map((lane) => (
                  <button
                    key={lane.repo}
                    type="button"
                    onClick={() => goTo(lane.repo)}
                    aria-label={lane.repo}
                    className={`flex shrink-0 items-center gap-1.5 rounded-lg border px-2 py-0.5 text-[12.5px] transition-colors ${
                      active === lane.repo
                        ? "border-accent bg-accent-dim text-fg"
                        : lane.yours
                          ? "border-accent/40 text-fg-mute"
                          : "border-line text-fg-mute"
                    }`}
                  >
                    <span className="max-w-[9rem] truncate">
                      {shortName(lane.repo)}
                    </span>
                    <span className="font-mono tabular-nums text-fg-quiet">
                      {lane.yours ? (
                        <span className="text-accent">{lane.yours}/</span>
                      ) : null}
                      {lane.rows.length}
                    </span>
                  </button>
                ))}
              </nav>

              <div
                ref={rowRef}
                className="h-board flex snap-x snap-mandatory gap-px overflow-x-auto overscroll-x-contain bg-line-soft md:snap-proximity"
              >
                {lanes.map((lane) => (
                  <Column
                    key={lane.repo}
                    lane={lane}
                    onChanged={() => void refresh()}
                    register={register}
                  />
                ))}
              </div>
            </>
          )}
        </div>

        <footer className="mt-4 hidden border-t border-line pt-3 text-[12px] text-fg-quiet md:block">
          Read live from GitHub, cached for a minute. Nothing is stored; labels
          are the only thing written back.
        </footer>
      </main>
    </>
  )
}
