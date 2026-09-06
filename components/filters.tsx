"use client"

import { useMemo, useState, type ReactNode } from "react"

import { REASON_TONE } from "@/components/board"
import type { Row } from "@/lib/github"
import { isEmptyPicks, samePicks, type View } from "@/lib/views"

/*
 * Narrowing the board to a context you actually work in.
 *
 * One control in the header rather than a rail per dimension: the section rail
 * is already a strip of chips, and a second strip beneath it would compete with
 * it while still not holding twenty repos.
 *
 * Three facets rather than one, and they combine the way you would expect
 * without being told: AND across facets, OR within one. Picking two repos means
 * "either of these"; picking a repo and a status means "in that repo AND in
 * that state". Anything else would need explaining, and a filter that needs
 * explaining is a worse filter than none.
 *
 * A native `popover` again — anchored from `md` up, the same element styled as a
 * bottom sheet below it. The browser owns Escape, click-outside, focus return
 * and top-layer rendering, which matters here because the board scrolls in both
 * axes and a tethered dropdown would be clipped by the column overflow.
 */

const ID = "board-filters"

/*
 * Drawn, in the same language as the section marks: 12 viewBox, ink inside a
 * concentric 10×10 band, 1.25 stroke. A different weight or grid here would
 * read as a second icon set rather than as more of the same one.
 */
const GLYPH: Record<Tab, ReactNode> = {
  /* A book with a spine — a repository. */
  repos: (
    <>
      <rect x="2.2" y="1.9" width="7.6" height="8.2" rx="1.4" />
      <path d="M4.5 1.9v8.2" />
    </>
  ),
  /* A trace. Status is the one facet that is about a row's condition rather
     than its identity, so it gets the only mark here that implies movement. */
  status: <path d="M1.3 6h2.3l1.4-3.2 1.9 6.4 1.4-3.2h2.4" />,
  /* A tag, hole included: without it this is just a rotated square. */
  labels: (
    <>
      <path d="M6.4 1.5h4.1v4.1L6 10.5 1.5 6z" />
      <circle cx="8.5" cy="3.5" r="0.85" fill="currentColor" stroke="none" />
    </>
  ),
}

const Glyph = ({ tab }: { tab: Tab }) => (
  <svg
    viewBox="0 0 12 12"
    aria-hidden
    className="size-3 shrink-0"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.25"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {GLYPH[tab]}
  </svg>
)

/* The dot a status row wears is the colour its chip wears on the card, so the
   list and the board agree without anyone having to learn a second scheme. */
const DOT: Record<string, string> = {
  alarm: "bg-brass",
  brass: "bg-brass/60",
  sage: "bg-sage",
  slate: "bg-slate/60",
}

/** More than this and a list needs a way to search itself. */
const TYPEAHEAD_AFTER = 10

export type Facet = { name: string; count: number }
export type RepoCount = Facet & { owner: string }

const tally = (values: Iterable<string>) => {
  const counts = new Map<string, number>()
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1)
  return (
    [...counts]
      .map(([name, count]) => ({ name, count }))
      /* By count, not alphabetically. The thing you want to silence is almost
       always the noisy one, so it should be the one under your thumb. */
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
  )
}

export const repoCounts = (rows: Row[]): RepoCount[] =>
  tally(rows.map((row) => row.repo)).map((entry) => ({
    ...entry,
    owner: entry.name.split("/")[0] ?? entry.name,
  }))

export const labelCounts = (rows: Row[]): Facet[] =>
  tally(rows.flatMap((row) => row.labels ?? []))

export const statusCounts = (rows: Row[], reasonFor: (row: Row) => string) =>
  tally(rows.map(reasonFor))

export type Picks = {
  repos: string[]
  status: string[]
  labels: string[]
  /* "you" and "them" — the board's own question, so it is a facet like any
     other rather than a mode. */
  move: string[]
}

export const countPicks = (picks: Picks) =>
  picks.repos.length +
  picks.status.length +
  picks.labels.length +
  picks.move.length

type Props = {
  repos: RepoCount[]
  status: Facet[]
  labels: Facet[]
  picks: Picks
  onChange: (next: Picks) => void
  views: View[]
  onViews: (next: View[]) => void
}

type Tab = "repos" | "status" | "labels"

const TABS: { id: Tab; label: string }[] = [
  { id: "repos", label: "Repos" },
  { id: "status", label: "Status" },
  { id: "labels", label: "Labels" },
]

export const Filters = ({
  repos,
  status,
  labels,
  picks,
  onChange,
  views,
  onViews,
}: Props) => {
  const [tab, setTab] = useState<Tab>("repos")
  const [needle, setNeedle] = useState("")
  const [naming, setNaming] = useState(false)
  const [name, setName] = useState("")

  const current = views.find((v) => samePicks(v.picks, picks))
  const savable = !isEmptyPicks(picks) && !current

  const save = () => {
    const trimmed = name.trim()
    if (!trimmed) return
    onViews([
      ...views.filter((v) => v.name !== trimmed),
      { name: trimmed, picks },
    ])
    setName("")
    setNaming(false)
  }

  const active = countPicks(picks)

  const toggle = (facet: Tab, value: string) =>
    onChange({
      ...picks,
      [facet]: picks[facet].includes(value)
        ? picks[facet].filter((v) => v !== value)
        : [...picks[facet], value],
    })

  const list: Facet[] =
    tab === "repos" ? repos : tab === "status" ? status : labels

  const shown = useMemo(() => {
    const q = needle.trim().toLowerCase()
    return q ? list.filter((e) => e.name.toLowerCase().includes(q)) : list
  }, [list, needle])

  /* Repos group by owner, which gives the personal-versus-work split — the
     granularity that actually matters — without inventing a second concept.
     Status and labels are flat: neither has an axis worth grouping on. */
  const byOwner = useMemo(() => {
    if (tab !== "repos") return null
    const owners = new Map<string, RepoCount[]>()
    for (const entry of shown as RepoCount[])
      owners.set(entry.owner, [...(owners.get(entry.owner) ?? []), entry])
    return [...owners].sort(
      (a, b) =>
        b[1].reduce((n, r) => n + r.count, 0) -
        a[1].reduce((n, r) => n + r.count, 0),
    )
  }, [tab, shown])

  const toggleOwner = (owner: string, all: RepoCount[]) => {
    const names = all.map((r) => r.name)
    const every = names.every((n) => picks.repos.includes(n))
    onChange({
      ...picks,
      repos: every
        ? picks.repos.filter((r) => !names.includes(r))
        : [...new Set([...picks.repos, ...names])],
    })
  }

  const Row_ = ({ name, count, label }: Facet & { label?: string }) => {
    const picked = picks[tab].includes(name)
    return (
      <button
        type="button"
        onClick={() => toggle(tab, name)}
        aria-pressed={picked}
        className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[13.5px] transition-colors ${
          picked ? "bg-accent-dim text-fg" : "text-fg-mute hover:bg-raise"
        }`}
      >
        {/* Shape as well as colour: a tick, not a tint alone. */}
        <span aria-hidden className="w-3 font-mono text-[12px]">
          {picked ? "✓" : ""}
        </span>
        {tab === "status" ? (
          <span
            aria-hidden
            className={`size-1.5 shrink-0 rounded-full ${DOT[REASON_TONE[name] ?? "slate"] ?? DOT.slate}`}
          />
        ) : tab === "labels" ? (
          <span aria-hidden className="text-fg-quiet">
            <Glyph tab="labels" />
          </span>
        ) : null}
        <span className="min-w-0 flex-1 truncate">{label ?? name}</span>
        {/* Without the count, unticking is guesswork — you cannot tell whether
            it costs you two rows or forty. */}
        <span className="font-mono text-[12.5px] tabular-nums text-fg-quiet">
          {count}
        </span>
      </button>
    )
  }

  return (
    <>
      {/*
        A funnel rather than the words, and a count rather than a sentence.

        "All repos" spent a header he has twice called too heavy on saying
        nothing was happening — the least interesting state the control has. As
        an icon it matches the avatar beside it, so the two read as a pair
        rather than as a label next to a face. `aria-label` says the whole
        sentence, so nothing was lost for anyone reading it aloud.
      */}
      <button
        type="button"
        popoverTarget={ID}
        aria-label={active ? `${active} filters applied` : "Filter the board"}
        className={`grid size-8 shrink-0 place-items-center rounded-full border transition-colors ${
          active
            ? "border-accent bg-accent-dim text-accent"
            : "border-line text-fg-mute hover:border-accent hover:text-fg"
        }`}
      >
        {active ? (
          <span className="font-mono text-[12px] tabular-nums leading-none">
            {active}
          </span>
        ) : (
          <svg viewBox="0 0 16 16" aria-hidden className="size-4">
            <path
              d="M2.5 3.5 H13.5 L9.5 8.25 V12.5 L6.5 13.75 V8.25 Z"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </button>

      <div
        id={ID}
        popover="auto"
        /*
          One height, whatever the tab.

          It used to size to its content, so switching from twenty-two repos to
          eight statuses collapsed the sheet under your thumb and moved the tabs
          you were aiming at. A control that changes shape as you use it is a
          control you have to re-find on every press.

          And the sheet itself no longer scrolls — the list inside it does. The
          fade belongs to the thing that is scrolling; on the sheet it was
          softening the card's own bottom edge and border, which is a frame, not
          content that continues.
        */
        className="m-auto flex h-[min(70dvh,540px)] w-[min(92vw,380px)] flex-col overflow-hidden rounded-2xl border border-line bg-panel p-3 text-fg shadow-[0_30px_80px_-40px_rgba(0,0,0,.9)] backdrop:bg-black/60"
      >
        <div className="flex shrink-0 items-center gap-2 pb-2">
          <b className="text-[15px] font-semibold">Filter</b>
          {active ? (
            <button
              type="button"
              onClick={() =>
                onChange({ repos: [], status: [], labels: [], move: [] })
              }
              className="ml-auto text-[12px] text-accent hover:underline"
            >
              Clear all
            </button>
          ) : null}
        </div>

        {/*
          Saved views, first, because switching between two or three shapes is a
          different act from building one — and it is the act he does daily.
          "At work" and "at home" are not filters he composes each morning;
          they are places he is.

          A view is a store, on a board whose whole argument is
          derive-never-mirror. That rule is about GitHub's facts, which can be
          wrong while GitHub is right. A view is a copy of nothing, so there is
          nothing for it to disagree with.
        */}
        {/*
          Always present, always the same height.

          It used to appear the moment you ticked anything and vanish when you
          cleared, so the tabs and the list jumped under your thumb at exactly
          the point you were aiming at them — the same fault as the sheet that
          resized per tab, one row higher. Reserved space costs 30px of a sheet
          that has a fixed height anyway; movement costs a mis-tap.
        */}
        <div className="mb-2 flex min-h-[30px] shrink-0 flex-wrap items-center gap-1.5">
          {views.map((view) => {
            const on = current?.name === view.name
            return (
              <span
                key={view.name}
                className={`flex items-center rounded-full border text-[12.5px] ${
                  on
                    ? "border-accent bg-accent-dim text-accent"
                    : "border-line text-fg-mute"
                }`}
              >
                <button
                  type="button"
                  onClick={() => onChange(view.picks)}
                  className="py-1 pl-2.5 pr-1.5"
                >
                  {view.name}
                </button>
                {/* Only the applied view can be deleted, so a mis-tap costs a
                      switch rather than a view. */}
                {on ? (
                  <button
                    type="button"
                    aria-label={`Delete ${view.name}`}
                    onClick={() =>
                      onViews(views.filter((v) => v.name !== view.name))
                    }
                    className="pr-2 text-[13px] leading-none opacity-70 hover:opacity-100"
                  >
                    ×
                  </button>
                ) : null}
              </span>
            )
          })}

          {/* The button holds its slot whether or not it can act, so the
                row's height never depends on what you have ticked. Disabled
                rather than hidden: absent, it would take the row with it. */}
          {!naming ? (
            <button
              type="button"
              disabled={!savable}
              onClick={() => setNaming(true)}
              title={
                savable
                  ? undefined
                  : isEmptyPicks(picks)
                    ? "Pick a filter first"
                    : "Already saved as a view"
              }
              className="rounded-full border border-dashed border-line px-2.5 py-1 text-[12.5px] text-fg-quiet transition-opacity hover:text-fg disabled:opacity-40 disabled:hover:text-fg-quiet"
            >
              Save this view
            </button>
          ) : null}

          {naming ? (
            <span className="flex flex-1 items-center gap-1.5">
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") save()
                  if (e.key === "Escape") setNaming(false)
                }}
                placeholder="At work"
                aria-label="Name this view"
                className="h-[26px] min-w-0 flex-1 rounded-lg border border-line bg-panel-2 px-2 text-[12.5px] outline-none focus:border-accent"
              />
              <button
                type="button"
                onClick={save}
                className="h-[26px] rounded-lg border border-accent bg-accent-dim px-2 text-[12.5px] text-accent"
              >
                Save
              </button>
            </span>
          ) : null}
        </div>

        {/*
          Whose move it is sits ABOVE the tabs, not inside them as a fourth.

          It is the one question this whole board exists to answer, and it was
          the only axis the filter could not express — you could approximate it
          by ticking four statuses, which is reconstructing the app's own
          central question out of proxies. Theo's find. A fourth tab would have
          buried the most-used filter one press deeper than the least-used one.
        */}
        <div className="mb-2 flex shrink-0 gap-1.5">
          {(
            [
              { id: "you", label: "Your move" },
              { id: "them", label: "Their move" },
            ] as const
          ).map((side) => {
            const picked = picks.move.includes(side.id)
            return (
              <button
                key={side.id}
                type="button"
                aria-pressed={picked}
                onClick={() =>
                  onChange({
                    ...picks,
                    move: picked
                      ? picks.move.filter((m) => m !== side.id)
                      : [...picks.move, side.id],
                  })
                }
                className={`flex-1 rounded-lg border px-2 py-1.5 text-[12.5px] transition-colors ${
                  picked
                    ? "border-accent bg-accent-dim text-accent"
                    : "border-line text-fg-quiet hover:text-fg"
                }`}
              >
                {side.label}
              </button>
            )
          })}
        </div>

        {/* Tabs rather than three stacked lists: stacked, the sheet would be
            four screens tall and the facet you wanted would always be the one
            below the fold. Each carries its own count, so a filter left on in a
            facet you are not looking at cannot hide from you. */}
        <div className="flex shrink-0 overflow-hidden rounded-lg border border-line">
          {TABS.map(({ id, label }) => {
            const n = picks[id].length
            return (
              <button
                key={id}
                type="button"
                onClick={() => {
                  setTab(id)
                  setNeedle("")
                }}
                aria-pressed={tab === id}
                className={`flex flex-1 items-center justify-center gap-1.5 px-2 py-1.5 text-[12.5px] transition-colors ${
                  tab === id
                    ? "bg-raise text-fg"
                    : "text-fg-quiet hover:text-fg-mute"
                }`}
              >
                <Glyph tab={id} />
                {label}
                {n ? (
                  <span className="rounded-full border border-accent bg-accent-dim px-1.5 text-[10.5px] text-accent">
                    {n}
                  </span>
                ) : null}
              </button>
            )
          })}
        </div>

        {repos.length > TYPEAHEAD_AFTER ? (
          <input
            type="search"
            value={needle}
            onChange={(e) => setNeedle(e.target.value)}
            placeholder={`Find a ${tab === "repos" ? "repository" : tab === "status" ? "status" : "label"}`}
            aria-label="Find"
            className="mb-2 mt-2 w-full shrink-0 rounded-lg border border-line bg-panel-2 px-2.5 py-1.5 text-[13px] outline-none focus:border-accent"
          />
        ) : (
          <div className="h-2" />
        )}

        {/*
          The list is the only part that scrolls, and the fade belongs to it.
          `min-h-0` is what lets a flex child actually shrink below its content
          — without it this box grows to fit and the sheet's fixed height is a
          suggestion. The negative margin puts the rows' own hover background
          back out to the sheet's padding, so a highlighted row is not inset
          from everything above it.
        */}
        <div className="fade-b -mx-1 min-h-0 flex-1 overflow-y-auto px-1 pb-5">
          {byOwner
            ? byOwner.map(([owner, entries]) => (
                <div key={owner} className="pb-2">
                  {/* The owner header is itself a toggle. */}
                  <button
                    type="button"
                    onClick={() => toggleOwner(owner, entries)}
                    className="w-full pb-1 text-left font-mono text-[11px] uppercase tracking-[0.12em] text-fg-quiet hover:text-fg-mute"
                  >
                    {owner}
                  </button>
                  {entries.map((entry) => (
                    <Row_
                      key={entry.name}
                      {...entry}
                      label={entry.name.slice(owner.length + 1)}
                    />
                  ))}
                </div>
              ))
            : shown.map((entry) => <Row_ key={entry.name} {...entry} />)}

          {shown.length === 0 ? (
            <p className="px-2 py-3 text-[13px] text-fg-quiet">
              Nothing matches that.
            </p>
          ) : null}
        </div>
      </div>
    </>
  )
}
