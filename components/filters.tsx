"use client"

import { useMemo, useState } from "react"

import type { Row } from "@/lib/github"

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

export type Picks = { repos: string[]; status: string[]; labels: string[] }

export const countPicks = (picks: Picks) =>
  picks.repos.length + picks.status.length + picks.labels.length

type Props = {
  repos: RepoCount[]
  status: Facet[]
  labels: Facet[]
  picks: Picks
  onChange: (next: Picks) => void
}

type Tab = keyof Picks

const TABS: { id: Tab; label: string }[] = [
  { id: "repos", label: "Repos" },
  { id: "status", label: "Status" },
  { id: "labels", label: "Labels" },
]

export const Filters = ({ repos, status, labels, picks, onChange }: Props) => {
  const [tab, setTab] = useState<Tab>("repos")
  const [needle, setNeedle] = useState("")

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
        className="fade-b m-auto max-h-[70dvh] w-[min(92vw,380px)] overflow-y-auto rounded-2xl border border-line bg-panel p-3 pb-6 text-fg shadow-[0_30px_80px_-40px_rgba(0,0,0,.9)] backdrop:bg-black/60 md:max-h-[60dvh]"
      >
        <div className="flex items-center gap-2 pb-2">
          <b className="text-[15px] font-semibold">Filter</b>
          {active ? (
            <button
              type="button"
              onClick={() => onChange({ repos: [], status: [], labels: [] })}
              className="ml-auto text-[12px] text-accent hover:underline"
            >
              Clear all
            </button>
          ) : null}
        </div>

        {/* Tabs rather than three stacked lists: stacked, the sheet would be
            four screens tall and the facet you wanted would always be the one
            below the fold. Each carries its own count, so a filter left on in a
            facet you are not looking at cannot hide from you. */}
        <div className="flex overflow-hidden rounded-lg border border-line">
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

        {list.length > TYPEAHEAD_AFTER ? (
          <input
            type="search"
            value={needle}
            onChange={(e) => setNeedle(e.target.value)}
            placeholder={`Find a ${tab === "repos" ? "repository" : tab === "status" ? "status" : "label"}`}
            aria-label="Find"
            className="mb-2 mt-2 w-full rounded-lg border border-line bg-panel-2 px-2.5 py-1.5 text-[13px] outline-none focus:border-accent"
          />
        ) : (
          <div className="h-2" />
        )}

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
    </>
  )
}
