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
  /* Two weights of the same hue, and the pair is the point: `alarm` is broken,
     `brass` is in flight. Same colour, so nothing has to be re-derived for the
     light theme; different strength, so the step is visible without a fifth
     hue. */
  alarm: "text-brass border-brass bg-brass/15",
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

/*
 * Four legible steps, and no more: slate says nothing is wrong, brass says it is
 * in flight, alarm says it is broken, sage says it is settled.
 *
 * Deliberately NOT accent. Accent means one thing on this board — "this one is
 * yours" — and it is already carried by the lane order, the `N you` pills and
 * the stripe. Spending it on "something noteworthy here" would let a stranger's
 * broken PR shout louder than the stripe that says the row is yours, and a
 * conflict on your own PR would say the same rose twice. Iris's call, and it is
 * the reason the loud tier is brass rather than a stronger red.
 */
const REASON_TONE: Record<string, string> = {
  "CI failing": "alarm",
  Conflict: "alarm",
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
  onOpen,
}: {
  row: Row
  onChanged: OnLabelChange
  onOpen: (row: Row) => void
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

      {/*
        The whole card opens the row, not just the title.

        `after:absolute after:inset-0` stretches this link over the card rather
        than wrapping the card in an anchor — wrapping would put the label
        buttons inside a link, which is invalid and which browsers resolve by
        guessing. This keeps one anchor, one accessible name, one tab stop, and
        a hit area the size of the thing you are aiming at.

        No hover underline: with the link covering the card, hovering anywhere
        would underline the title, so the cue would fire nowhere near the
        pointer. The card's own lift and background already answer the hover.
        `focus-visible` keeps it, because a keyboard user has no pointer to say
        where they are.
      */}
      <a
        href={row.url}
        target="_blank"
        rel="noreferrer"
        onClick={(e) => {
          if (!matchMedia("(min-width: 768px)").matches) return
          e.preventDefault()
          onOpen(row)
        }}
        className="line-clamp-3 text-pretty text-[14.5px] font-semibold leading-[1.4] text-fg after:absolute after:inset-0 focus:outline-none focus-visible:underline"
      >
        {row.title}
      </a>

      {/* Above the stretched link, or the labels stop being clickable. */}
      <div className="relative z-[1]">
        <RowLabels
          repo={row.repo}
          number={row.number}
          labels={row.labels ?? []}
          onChanged={onChanged}
        />
      </div>

      <div className="mt-1.5 flex items-center gap-2">
        {/*
          The chip takes its own tone on every card, not only on yours.

          It used to fall through to slate whenever the row was someone else's,
          which meant a conflict on an incoming PR rendered identically to a
          plain "Open" — the state was computed, written on the card, and then
          made unreadable. The glyph on the loud tier is not decoration: it is
          what keeps the step legible in daylight and to a reader who cannot
          separate the two brasses by hue.
        */}
        <span
          className={`shrink-0 rounded border px-1.5 py-px text-[11px] ${
            TONE[REASON_TONE[reason] ?? "slate"] ?? TONE.slate
          }`}
        >
          {REASON_TONE[reason] === "alarm" ? <span aria-hidden>! </span> : null}
          {reason}
        </span>
        <span className="ml-auto shrink-0 font-mono text-[12px] tabular-nums text-fg-quiet">
          {row.activityAge ?? row.age}
        </span>
      </div>
    </article>
  )
}

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
  onOpen,
}: {
  rows: Row[]
  cap: number
  onChanged: OnLabelChange
  onOpen: (row: Row) => void
}) => {
  const [all, setAll] = useState(false)
  const shown = all ? rows : rows.slice(0, cap)

  return (
    <>
      {shown.map((row) => (
        <Card key={row.url} row={row} onChanged={onChanged} onOpen={onOpen} />
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
  onOpen,
  register,
  scroller,
  folded,
  onFold,
}: {
  lanes: Lane[]
  columns: string[]
  counts: Map<string, number>
  onChanged: OnLabelChange
  onOpen: (row: Row) => void
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
      className="h-full overflow-auto overscroll-x-contain scroll-pl-[var(--ym-lane)] scroll-pt-[var(--ym-head)] [--ym-col:64vw] [--ym-head:41px] [--ym-lane:104px] [--ym-tail:max(0px,calc(100dvw-1.5rem-2px-var(--ym-lane)-var(--ym-col)))] [scroll-snap-type:both_mandatory] md:[--ym-col:300px] md:[--ym-lane:150px] md:[--ym-tail:max(0px,calc(min(100dvw,1600px)-3rem-2px-var(--ym-lane)-var(--ym-col)))] md:[scroll-snap-type:both_proximity]"
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

            {/*
              A folded lane keeps its columns.

              It used to collapse to one strip spanning the whole row, which
              threw away the thing the fold is meant to preserve: the matrix.
              Reading "3 open, 1 review" as a sentence is work; seeing which
              columns are filled, in the same places they always are, is not.
              So the cells stay, and the hatch runs the whole row rather than only
              the cells with something in them: one patch mid-row reads as an
              anomaly, where a hatched row reads as a state. The counts still
              land under the same sticky headers as everything else, so folding
              costs detail rather than position.
            */}
            {columns.map((id) => {
              const rows = lane.cells.get(id) ?? []
              const shut = folded.has(lane.repo)
              /* An empty cell is not a box. No border, no background, no
                 sentence — blank space between the hairlines already reads as
                 an empty cell, where an empty bordered box reads as a broken
                 component. Folded, the same rule holds: only a cell with
                 something in it is hatched. */
              return (
                <div
                  key={id}
                  className={`flex flex-col gap-2 border-b border-r border-line-soft p-2 [scroll-snap-align:none_start] ${
                    shut ? "hatch min-h-[34px] justify-center" : "min-h-[44px]"
                  } ${SEAM.has(id) ? "border-l border-l-accent/40" : ""}`}
                >
                  {!rows.length ? null : shut ? (
                    <span className="font-mono text-[12px] tabular-nums leading-none text-fg-quiet">
                      {rows.length}
                    </span>
                  ) : (
                    <Cell
                      rows={rows}
                      cap={id === DONE ? DONE_PER_CELL : PER_CELL}
                      onChanged={onChanged}
                      onOpen={onOpen}
                    />
                  )}
                </div>
              )
            })}
            <div
              className={`border-b border-line-soft ${folded.has(lane.repo) ? "hatch" : ""}`}
            />
          </Fragment>
        ))}
      </div>
    </div>
  )
}
