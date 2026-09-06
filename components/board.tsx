"use client"

import { Fragment, memo, useRef, useState } from "react"

import { RowLabels } from "@/components/row-labels"
import { presentationFor } from "@/lib/sections"
import type { Row } from "@/lib/github"

/*
 * The swimlane grid and its narrow twin.
 *
 * Wide: STATUS across the top as fixed columns, one PROJECT per lane down the
 * page, the lane's name sticky at the left so scrolling sideways never leaves
 * you looking at cards belonging to a project you can no longer name.
 *
 * Narrow: the same content with the horizontal axis removed entirely — lanes
 * stacked, sections as sticky sub-headers inside them. Which axis to sacrifice
 * was settled by the complaint that produced this board: "I can't see my
 * projects." The phone keeps projects; status stays reachable through the
 * sub-headers and the reason chip on every card.
 */

export const TONE: Record<string, string> = {
  accent: "text-accent border-accent bg-accent-dim",
  brass: "text-brass border-brass/40 bg-brass/10",
  sage: "text-sage border-sage/40 bg-sage/10",
  slate: "text-slate border-line bg-panel-2",
}

/*
 * Left to right is a LIFECYCLE, not a priority ranking — and it is two of them.
 *
 * Urgency already has three carriers: lanes are ordered by it, the `N you` pills
 * announce it, and the accent stripe marks it on the card. Spending the
 * horizontal axis on it as well was waste, and actively misleading: `done` at
 * the right end makes any matrix promise a progression, so a reader tries to
 * read one and finds a ranking instead.
 *
 * What was hiding under "the order feels slightly off" is that there is no
 * single sequence to find. There are two, sharing a terminus: your own work
 * (issue → assigned → you open a PR) and other people's passing through you
 * (it arrives → it asks for your review → you have reviewed it). Interleaving
 * them is what made every candidate ordering feel wrong.
 */
const YOURS = ["issues", "assigned", "open"]
const THEIRS = ["incoming", "review", "reviewed"]
const CLOSED = ["done"]

export const GROUPS: { label: string; ids: string[] }[] = [
  { label: "Yours", ids: YOURS },
  { label: "Theirs", ids: THEIRS },
  { label: "Closed", ids: CLOSED },
]

export const COLUMNS = [...YOURS, ...THEIRS, ...CLOSED]

/** Where one lifecycle ends and the next begins, drawn rather than implied. */
const SEAM = new Set([THEIRS[0], CLOSED[0]])

export const DONE = "done"

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

export const sectionOf = (row: Row): string => SECTION_OF[row.source] ?? "open"

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
export const reasonFor = (row: Row): string => {
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

export const shortName = (repo: string) => repo.split("/").pop() ?? repo

/** A cell shows this many, then says how many it is holding back. */
const PER_CELL = 4
const DONE_PER_CELL = 2

export const Slot = ({ glyph, tone }: { glyph: string; tone: string }) => (
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
 * it renders in the top layer, so the grid's overflow cannot clip it.
 */
export const About = ({
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
      className="grid size-4 shrink-0 place-items-center rounded-full border border-line font-mono text-[11px] leading-none text-fg-quiet transition-colors hover:border-accent hover:text-accent"
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
 * The card carries no repository: the lane says it once, for every card in it.
 * That is the compression a grid buys, and it is why this card is shorter than
 * on either single-axis board that came before.
 */
const CardBody = ({
  row,
  onChanged,
}: {
  row: Row
  onChanged: OnLabelChange
}) => {
  const reason = reasonFor(row)
  const yours = row.move === "you"

  return (
    <article className="group relative rounded-[9px] border border-line bg-panel-2 p-2.5 transition-[background,border-color,transform] duration-150 hover:-translate-y-px hover:border-[#333941] hover:bg-raise">
      {/* Position and shape, not hue alone: a bar on the leading edge. */}
      {yours ? (
        <span
          aria-hidden
          className="absolute inset-y-2 left-0 w-[2px] rounded-full bg-accent"
        />
      ) : null}

      <a
        href={row.url}
        target="_blank"
        rel="noreferrer"
        className="line-clamp-3 text-pretty text-[14.5px] font-semibold leading-[1.4] text-fg hover:underline focus:underline focus:outline-none"
      >
        {row.title}
      </a>

      <RowLabels
        repo={row.repo}
        number={row.number}
        labels={row.labels ?? []}
        onChanged={onChanged}
      />

      <div className="mt-1.5 flex items-center gap-2">
        <span
          className={`shrink-0 rounded border px-1.5 py-px text-[11px] ${
            yours
              ? (TONE[REASON_TONE[reason] ?? "slate"] ?? TONE.slate)
              : TONE.slate
          }`}
        >
          {reason}
        </span>
        <span className="ml-auto shrink-0 font-mono text-[12px] tabular-nums text-fg-quiet">
          {row.activityAge ?? row.age}
        </span>
      </div>
    </article>
  )
}

/* A folded lane keeps its name and its shape — the counts stay visible, so
   folding is hiding detail rather than hiding the project. */
const Summary = ({ lane, columns }: { lane: Lane; columns: string[] }) => (
  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-2 py-1.5">
    {columns
      .filter((id) => (lane.cells.get(id) ?? []).length)
      .map((id) => {
        const p = presentationFor(id)
        return (
          <span
            key={id}
            className="flex items-center gap-1 text-[12px] text-fg-quiet"
          >
            <span aria-hidden className="font-mono">
              {p.glyph}
            </span>
            <span className="hidden lg:inline">{p.title}</span>
            <span className="font-mono tabular-nums">
              {(lane.cells.get(id) ?? []).length}
            </span>
          </span>
        )
      })}
  </div>
)

/*
 * The full `owner/name`, on demand, gone by itself.
 *
 * A `popover` again: top layer, so the grid's overflow cannot clip it, and the
 * browser owns Escape, click-outside and focus return. What it adds here is a
 * timer — he asked for something that disappears on its own, so it does, and a
 * finger held down pauses it rather than fighting it.
 *
 * Discoverability is the part that decides whether this works at all. With no
 * hover, a tap that only reveals is invisible — so the truncation is rendered as
 * a deliberate accent-coloured ellipsis rather than the browser's grey one, and
 * only names that actually need it carry the affordance. An affordance that is
 * sometimes a lie is worse than none.
 */
const REVEAL_MS = 2500

/* The label column is 104px narrow, 150px wide; at 14px this is where a short
   name stops fitting. Approximate on purpose — the cost of being wrong is an
   ellipsis that reveals a name you could already read. */
const FITS = 11

const LaneName = ({ repo }: { repo: string }) => {
  const short = shortName(repo)
  const long = short.length > FITS
  const id = `lane-${repo.replace(/[^a-z0-9]/gi, "-")}`
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)

  const arm = () => {
    clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      document.getElementById(id)?.hidePopover?.()
    }, REVEAL_MS)
  }

  if (!long)
    return (
      <h4 className="truncate text-[14px] font-semibold leading-tight text-fg md:text-[15.5px]">
        {short}
      </h4>
    )

  return (
    <>
      {/*
        A <button>, and that is not a style choice.

        `popovertarget` is only honoured on a button or an input of type button.
        On anything else — an <h4>, say — the browser ignores the attribute
        entirely and silently: no error, no warning, and a tap that does
        nothing. Which is exactly what it did.
      */}
      <button
        type="button"
        title={repo}
        aria-label={repo}
        popoverTarget={id}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={() => clearTimeout(timer.current)}
        onPointerUp={arm}
        className="min-w-0 truncate text-left text-[14px] font-semibold leading-tight text-fg md:text-[15.5px]"
      >
        {short.slice(0, FITS)}
        <span className="text-accent">…</span>
      </button>

      <div
        id={id}
        popover="auto"
        onToggle={arm}
        className="m-auto rounded-lg border border-line bg-panel px-3 py-2 text-fg shadow-[0_20px_60px_-30px_rgba(0,0,0,.9)] backdrop:bg-black/30"
      >
        <p className="font-mono text-[13px]">{repo}</p>
      </div>
    </>
  )
}

export type OnLabelChange = (
  repo: string,
  number: number,
  label: string,
  action: "add" | "remove",
) => void

export type Lane = {
  repo: string
  yours: number
  total: number
  cells: Map<string, Row[]>
}

/*
 * A cell caps its contents rather than growing without limit — a lane is as tall
 * as its fullest cell, and one busy project would otherwise make every other
 * lane a strip in a tall empty row. Expanding happens in place, because a third
 * scroll axis inside a grid that already has two is unusable.
 */
/*
 * Seventy cards re-rendering because a clock ticked is most of what this page
 * asks of the main thread. A card depends on its row and one stable callback,
 * so the default shallow comparison is exactly the right test.
 */
export const Card = memo(CardBody)
Card.displayName = "Card"

const Cell = ({
  rows,
  cap,
  onChanged,
}: {
  rows: Row[]
  cap: number
  onChanged: OnLabelChange
}) => {
  const [all, setAll] = useState(false)
  const shown = all ? rows : rows.slice(0, cap)

  return (
    <>
      {shown.map((row) => (
        <Card key={row.url} row={row} onChanged={onChanged} />
      ))}
      {rows.length > cap && !all ? (
        <button
          type="button"
          onClick={() => setAll(true)}
          className="rounded-lg border border-dashed border-line py-1 text-[12px] text-fg-quiet hover:border-accent hover:text-fg-mute"
        >
          +{rows.length - cap} more
        </button>
      ) : null}
    </>
  )
}

/** Wide: the grid. */
export const Swimlanes = ({
  lanes,
  columns,
  counts,
  onChanged,
  register,
  scroller,
  folded,
  onFold,
}: {
  lanes: Lane[]
  columns: string[]
  counts: Map<string, number>
  onChanged: OnLabelChange
  register: (id: string, el: HTMLElement | null) => void
  scroller: React.Ref<HTMLDivElement>
  folded: Set<string>
  onFold: (repo: string) => void
}) => {
  /*
   * Every column the same width, including the empty ones.
   *
   * An earlier version narrowed empty columns to a rail to buy horizontal
   * budget. It cost more than it bought: a matrix with uneven columns stops
   * reading as a matrix, the vertical alignment that makes "everything in
   * review, across all projects" legible is broken, and — the part that decides
   * it — the snap positions become irregular, so the gesture lands somewhere
   * different depending on which columns happen to be empty today. A grid whose
   * geometry changes with its contents is not furniture.
   */
  const track = `var(--ym-lane) repeat(${columns.length}, var(--ym-col)) var(--ym-tail)`

  return (
    <div
      ref={scroller}
      className="h-full overflow-auto overscroll-x-contain scroll-pl-[var(--ym-lane)] scroll-pt-[var(--ym-head)] [--ym-col:64vw] [--ym-head:41px] [--ym-lane:104px] [--ym-tail:max(0px,calc(100dvw-1.5rem-var(--ym-lane)-var(--ym-col)))] [scroll-snap-type:both_mandatory] md:[--ym-col:300px] md:[--ym-lane:150px] md:[--ym-tail:max(0px,calc(min(100dvw,1600px)-4rem-var(--ym-lane)-var(--ym-col)))] md:[scroll-snap-type:both_proximity]"
    >
      <div
        className="grid min-w-max content-start"
        style={{ gridTemplateColumns: track }}
      >
        {/* The group row names the two lifecycles. Answering "does this read
            as a timeline" with visible structure beats answering it with a
            reorder alone. */}
        <div className="sticky left-0 z-30 hidden border-r border-line bg-panel md:block" />
        {GROUPS.map((group) => (
          <div
            key={group.label}
            className="hidden bg-panel px-2 pt-1.5 font-mono text-[9.5px] uppercase tracking-[0.16em] text-fg-quiet md:block"
            style={{ gridColumn: `span ${group.ids.length}` }}
          >
            {group.label}
          </div>
        ))}
        <div className="hidden bg-panel md:block" />

        {/* Corner: the one cell belonging to both sticky axes. */}
        <div className="sticky left-0 top-0 z-30 h-[41px] border-b border-r border-line bg-panel" />

        {columns.map((id) => {
          const p = presentationFor(id)
          return (
            <div
              key={id}
              ref={(el) => register(id, el)}
              data-column={id}
              className={`sticky top-0 z-20 flex h-[41px] items-center gap-1.5 border-b border-r border-line-soft bg-panel px-2 [scroll-snap-align:none_start] ${
                SEAM.has(id) ? "border-l border-l-accent/40" : ""
              }`}
            >
              <Slot glyph={p.glyph} tone={p.tone} />
              <h3 className="truncate text-[13px] font-semibold text-fg md:text-[13.5px]">
                {p.title}
              </h3>
              <span className="ml-auto font-mono text-[12px] tabular-nums text-fg-quiet">
                {counts.get(id) ?? 0}
              </span>
              <About id={`about-${id}`} title={p.title} meaning={p.meaning} />
            </div>
          )
        })}
        <div className="sticky top-0 z-20 h-[41px] border-b border-line-soft bg-panel" />

        {lanes.map((lane) => (
          <Fragment key={lane.repo}>
            {/* Sticky left: without it you lose which lane you are in the
                moment you scroll right, and the grid becomes unreadable. */}
            {/*
              * Fold on the cell, reveal on the name.
              *
              * The handler sits on the whole label — chevron, counts, empty
              * space — and the name stops propagation. So the collapse really is
              * "around the title", and the one thing the title does is say what
              * it could not fit.
              */}
            <div
              onClick={() => onFold(lane.repo)}
              className={`sticky left-0 z-10 flex cursor-pointer flex-col justify-start gap-1 border-b border-r-2 border-b-line border-r-line bg-panel p-2 text-left hover:bg-raise [scroll-snap-align:start_none] ${
                lane.yours ? "border-r-accent/60" : ""
              }`}
            >
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    onFold(lane.repo)
                  }}
                  aria-expanded={!folded.has(lane.repo)}
                  aria-label={`${folded.has(lane.repo) ? "Expand" : "Collapse"} ${lane.repo}`}
                  className="font-mono text-[11px] leading-none text-fg-quiet transition-transform"
                  style={{
                    transform: folded.has(lane.repo)
                      ? "rotate(-90deg)"
                      : undefined,
                  }}
                >
                  ▾
                </button>

                <LaneName repo={lane.repo} />
              </div>

              <p className="flex items-center gap-1.5">
                {lane.yours ? (
                  <span className="rounded-full border border-accent bg-accent-dim px-1.5 py-px text-[10.5px] text-accent">
                    {lane.yours} you
                  </span>
                ) : null}
                <span className="font-mono text-[11.5px] tabular-nums text-fg-quiet">
                  {lane.total}
                </span>
              </p>
            </div>

            {folded.has(lane.repo) ? (
              <div
                className="border-b border-line-soft"
                style={{ gridColumn: "2 / -1" }}
              >
                <Summary lane={lane} columns={columns} />
              </div>
            ) : (
              columns.map((id) => {
              const rows = lane.cells.get(id) ?? []
              /* An empty cell is not a box. No border, no background, no
                 sentence — blank space between the hairlines already reads as
                 an empty cell, where an empty bordered box reads as a broken
                 component. */
              return (
                <div
                  key={id}
                  className={`flex min-h-[44px] flex-col gap-2 border-b border-r border-line-soft p-2 [scroll-snap-align:none_start] ${
                    SEAM.has(id) ? "border-l border-l-accent/40" : ""
                  }`}
                >
                  {rows.length ? (
                    <Cell
                      rows={rows}
                      cap={id === DONE ? DONE_PER_CELL : PER_CELL}
                      onChanged={onChanged}
                    />
                  ) : null}
                </div>
              )
              })
            )}
            {folded.has(lane.repo) ? null : (
              <div className="border-b border-line-soft" />
            )}
          </Fragment>
        ))}
      </div>
    </div>
  )
}
