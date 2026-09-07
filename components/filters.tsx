"use client"

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react"

import { REASON_TONE } from "@/components/board"
import type { Row } from "@/lib/github"
import { emptyPicks, isEmptyPicks, samePicks, type View } from "@/lib/views"

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

export const FILTERS_ID = "board-filters"
const ID = FILTERS_ID

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

export const Glyph = ({ tab }: { tab: Tab }) => (
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
  /* Not a fifth facet — a second way of writing the repos one. An owner pick
     is a standing predicate ("everything theorchard has, including what it has
     next week") where a repo list is a snapshot, so the two OR together within
     one dimension and the header's "AND across facets" rule holds unchanged. */
  owners: string[]
  status: string[]
  labels: string[]
  /* "you" and "them" — the board's own question, so it is a facet like any
     other rather than a mode. */
  move: string[]
}

/*
 * What the banner says, and the rule is: name up to two, count past that.
 *
 * Two is where a list stops being a thing you are in and becomes a set you
 * assembled. At three the eye starts counting rather than reading, and once you
 * are counting, the number is the better representation — shorter, exact, and
 * stable while the set changes. Fifteen repository names tell you strictly less
 * than "15 repos" does, and they cost three lines of banner to say it.
 */
const NAME_UP_TO = 2

const some = (values: string[], plural: string) =>
  values.length <= NAME_UP_TO
    ? values.join(", ")
    : `${values.length} ${plural}`

export type Part = { key: string; kind?: Tab; text: string; full: string }

export const summarise = (picks: Picks, short: (repo: string) => string) => {
  const parts: Part[] = []

  if (picks.move.length)
    parts.push({
      key: "move",
      text: picks.move
        .map((m) => (m === "you" ? "your move" : "their move"))
        .join(" or "),
      full: "",
    })

  /* Owners and repos are one dimension, so they are one segment. "All of"
     carries the durable half: an owner pick covers what that owner has NEXT
     WEEK, and a banner reading the same for fifteen ticked repositories would
     hide the only difference that matters. */
  if (picks.owners.length || picks.repos.length)
    parts.push({
      key: "where",
      kind: "repos",
      text: [
        picks.owners.length ? `all of ${some(picks.owners, "owners")}` : "",
        picks.repos.length ? some(picks.repos.map(short), "repos") : "",
      ]
        .filter(Boolean)
        .join(" + "),
      full: [
        ...picks.owners.map((o) => `all of ${o}`),
        ...picks.repos,
      ].join(", "),
    })

  if (picks.status.length)
    parts.push({
      key: "status",
      kind: "status",
      text: some(picks.status, "statuses"),
      full: picks.status.join(", "),
    })

  if (picks.labels.length)
    parts.push({
      key: "labels",
      kind: "labels",
      text: some(picks.labels, "labels"),
      full: picks.labels.join(", "),
    })

  return parts
}

export const countPicks = (picks: Picks) =>
  picks.repos.length +
  picks.owners.length +
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
  const search = useRef<HTMLInputElement>(null)
  const [name, setName] = useState("")

  /*
   * ⌘K opens the control that already exists rather than adding a surface.
   *
   * Deliberately not a command palette. `gh-cockpit` is the keyboard-first
   * product, and this is the graphical one — two postures reading the same
   * facts, not one product in two skins. A palette here would be the second
   * skin, and it would need its own vocabulary of actions to justify itself.
   *
   * What this is instead: the shortest route to the repository search that is
   * already in the sheet, with the field focused. It adds no concept, and if
   * the shortcut is never pressed nothing about the app is different.
   */
  useEffect(() => {
    const open = (event: KeyboardEvent) => {
      if (event.key !== "k" || !(event.metaKey || event.ctrlKey)) return
      event.preventDefault()

      const sheet = document.getElementById(ID)
      if (!sheet) return
      /* Already open on another facet is still a hit: it means "find me a
         repository", so it switches rather than closing. */
      if (!sheet.matches(":popover-open")) sheet.showPopover()
      setTab("repos")
      setNeedle("")
      requestAnimationFrame(() => search.current?.select())
    }

    addEventListener("keydown", open)
    return () => removeEventListener("keydown", open)
  }, [])

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

  const toggle = (facet: Tab, value: string) => {
    /*
     * Pressing a repository row means "filter to this repository" everywhere
     * else in this sheet, and it must not acquire a subtractive second meaning
     * inside a covered group. So a press on a row covered by its owner drops
     * the owner pick and takes that one repo — the header goes from All to
     * 1/15, the siblings lose their dot, and the banner follows. One press, one
     * meaning, everything moving together.
     *
     * The alternative — expanding the owner into the fourteen others — is the
     * snapshot this whole change exists to stop, materialised silently.
     */
    const owner = facet === "repos" ? (value.split("/")[0] ?? "") : ""
    if (owner && picks.owners.includes(owner))
      return onChange({
        ...picks,
        owners: picks.owners.filter((o) => o !== owner),
        repos: [...picks.repos, value],
      })

    onChange({
      ...picks,
      [facet]: picks[facet].includes(value)
        ? picks[facet].filter((v) => v !== value)
        : [...picks[facet], value],
    })
  }

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
    /* A picked owner keeps its header even with nothing left to show, or the
       filter becomes one you can switch on and then cannot switch off: the
       banner says it is live and no control anywhere can reach it. */
    for (const owner of picks.owners)
      if (!owners.has(owner)) owners.set(owner, [])
    return [...owners].sort(
      (a, b) =>
        b[1].reduce((n, r) => n + r.count, 0) -
        a[1].reduce((n, r) => n + r.count, 0),
    )
  }, [tab, shown, picks.owners])

  /*
   * The owner itself, never an expansion of its children.
   *
   * Ticking fifteen repositories would make the state indistinguishable from an
   * enumeration one press after the user asked for the opposite — and a repo
   * created tomorrow would then arrive UNTICKED beside fifteen ticked siblings,
   * which reads as deliberately excluded. They tick it, and now they really do
   * hold a snapshot. The interface would have talked them out of the feature.
   */
  const toggleOwner = (owner: string) => {
    const held = picks.owners.includes(owner)
    onChange({
      ...picks,
      owners: held
        ? picks.owners.filter((o) => o !== owner)
        : [...picks.owners, owner],
      /* Picking the owner supersedes any of its repos already ticked: they are
         covered by it, and leaving them would be two facts saying one thing,
         one of which goes stale the moment a repository is added. */
      repos: held
        ? picks.repos
        : picks.repos.filter((r) => !r.startsWith(`${owner}/`)),
    })
  }

  /*
   * The header's own state is BINARY — this owner, or not — and the tick column
   * says only that. The fraction beside it reports on the rows below; it is
   * never a third state of the header. A half-tick here would mean "some of
   * these are off", which promises exclusion, and exclusion is precisely what
   * an owner pick does not offer.
   *
   * "All" is a promise about the future; a fraction is a report on the present.
   * The two must never read as the same claim.
   */
  const OwnerHead = ({
    owner,
    entries,
  }: {
    owner: string
    entries: RepoCount[]
  }) => {
    const whole = picks.owners.includes(owner)
    const ticked = entries.filter((e) => picks.repos.includes(e.name)).length

    return (
      <button
        type="button"
        onClick={() => toggleOwner(owner)}
        aria-pressed={whole}
        title={
          whole
            ? `Everything in ${owner}, including repositories added later`
            : `Filter to everything in ${owner}`
        }
        aria-label={
          whole
            ? `${owner} — all repositories, including new ones`
            : ticked
              ? `${owner} — ${ticked} of ${entries.length} repositories picked`
              : `${owner} — ${entries.length} repositories`
        }
        className={`mb-1 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left font-mono text-[11px] uppercase tracking-[0.12em] transition-colors ${
          whole
            ? "bg-accent-dim text-fg"
            : ticked
              ? "text-fg-mute hover:bg-raise"
              : "text-fg-quiet hover:bg-raise"
        }`}
      >
        <span
          aria-hidden
          className="w-3 text-[12px] normal-case tracking-normal"
        >
          {whole ? "✓" : ""}
        </span>
        {/*
          The avatar goes here rather than on each row because the list is
          already grouped by owner: repeated per row it would be the same
          picture eight times, which is decoration. On the header it does work —
          two owners are told apart by recognition rather than by reading, which
          is exactly the personal-versus-work split these filters exist for.

          A stable URL off a name we already have, so nothing is fetched to
          learn who someone is, and `size=64` into a 20px box because a phone at
          3x would otherwise show it soft.
        */}
        <img
          src={`https://github.com/${owner}.png?size=64`}
          alt=""
          width={20}
          height={20}
          loading="lazy"
          className={`size-5 shrink-0 rounded-full border ${
            whole ? "border-accent" : "border-line"
          }`}
        />
        <span className="min-w-0 flex-1 truncate">{owner}</span>
        <span className="text-[10.5px] normal-case tracking-normal text-fg-quiet">
          {whole ? "All" : ticked ? `${ticked}/${entries.length}` : entries.length}
        </span>
      </button>
    )
  }

  const Row_ = ({ name, count, label }: Facet & { label?: string }) => {
    const picked = picks[tab].includes(name)
    /* Covered, not picked: this repo's OWNER is picked, so it is in — and so is
       the one created tomorrow. A tick here would credit the wrong fact, and an
       empty column would read as excluded, which is the one thing an owner pick
       does not offer. */
    const covered =
      tab === "repos" && picks.owners.includes(name.split("/")[0] ?? "")
    return (
      <button
        type="button"
        onClick={() => toggle(tab, name)}
        aria-pressed={picked}
        title={covered ? `Filter to ${label ?? name} alone` : undefined}
        className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[13.5px] transition-colors ${
          picked
            ? "bg-accent-dim text-fg"
            : covered
              ? "text-fg hover:bg-raise"
              : "text-fg-mute hover:bg-raise"
        }`}
      >
        {/* Shape as well as colour: three states, three marks. No tint on a
            covered row — the header carries the group's highlight, and
            repeating it down fifteen rows is ornament. */}
        <span aria-hidden className="w-3 font-mono text-[12px]">
          {picked ? "✓" : covered ? "·" : ""}
        </span>
        {/* Each facet's rows wear the mark of what they are, so the three
            lists read as one family rather than as three lists. */}
        <span aria-hidden className="shrink-0 text-fg-quiet">
          {tab === "status" ? (
            <span
              className={`block size-1.5 rounded-full ${DOT[REASON_TONE[name] ?? "slate"] ?? DOT.slate}`}
            />
          ) : (
            <Glyph tab={tab} />
          )}
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
        /* `[&:popover-open]:flex` rather than a bare `flex`, and this is a correctness
           fix rather than a style: the UA hides a closed popover with
           `[popover]:not(:popover-open){display:none}`, and an author `display`
           utility beats it. So the panel stayed laid out while closed — invisible,
           but `position:fixed` from the UA sheet and still taking its own hit area
           over the page. It sat across the right end of the filter banner, which is
           why `Clear` could not be pressed, and why pressing there sometimes landed
           on the GitHub link inside this very panel. */
        className="m-auto h-[min(70dvh,540px)] w-[min(92vw,380px)] flex-col [&:popover-open]:flex overflow-hidden rounded-2xl border border-line bg-panel p-3 text-fg shadow-[0_30px_80px_-40px_rgba(0,0,0,.9)] backdrop:bg-black/60"
      >
        <div className="flex shrink-0 items-center gap-2 pb-2">
          <b className="text-[15px] font-semibold">Filter</b>
          {active ? (
            <button
              type="button"
              onClick={() =>
                onChange(emptyPicks())
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
          Saved views are NAVIGATION, and navigation goes at the top.

          Creating one is the opposite act — the end of composing rather than
          the start of choosing — and the two shared a row until now, which
          asked you to read the same strip at two opposite moments. The save
          control is in the footer instead.

          Rendered only when there is something to navigate between, which is
          stable in the way that matters: it changes when you save or delete a
          view, which is rare and deliberate, and never while you are ticking
          filters, which is constant.
        */}
        {views.length ? (
          <div className="mb-2 flex shrink-0 flex-wrap items-center gap-1.5">
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
                  {/*
                    A toggle, not an apply. The chip already wears the grammar
                    of pressed — accent border, accent-dim fill — and pressing a
                    lit one did nothing, which is the failure this file's own
                    contrast note names: a control that reports a state the page
                    does not honour is worse than a missing one.

                    Off can only mean `emptyPicks()`, because a lit chip means
                    the picks ARE this view exactly — that is what `current`
                    tests — so there is nothing else it could be turning off.
                  */}
                  <button
                    type="button"
                    onClick={() => onChange(on ? emptyPicks() : view.picks)}
                    aria-pressed={on}
                    title={on ? `Turn off ${view.name}` : `Apply ${view.name}`}
                    className="flex items-center gap-1 py-1 pl-2 pr-1.5"
                  >
                    {/* The same tick a picked row wears, so a lit chip and a
                        ticked row say "on" with one mark rather than by hue
                        alone. The width is reserved so a chip does not resize
                        as it lights — the whole wrapped row would reflow under
                        the thumb mid-press. */}
                    <span
                      aria-hidden
                      className="w-3 shrink-0 font-mono text-[11px]"
                    >
                      {on ? "✓" : ""}
                    </span>
                    {view.name}
                  </button>
                  {on ? (
                    <button
                      type="button"
                      aria-label={`Delete ${view.name}`}
                      onClick={() =>
                        onViews(views.filter((v) => v.name !== view.name))
                      }
                      /* A hairline splits the chip into its two acts. The old
                         rationale — only the applied view can be deleted, so a
                         mis-tap costs a switch rather than a view — inverts now
                         that the body is a toggle: turning a view off and
                         deleting it are both "make this stop", a pixel apart,
                         and only one comes back. */
                      className="ml-0.5 border-l border-accent/30 py-1 pl-1.5 pr-2 text-[13px] leading-none opacity-70 hover:opacity-100"
                    >
                      ×
                    </button>
                  ) : null}
                </span>
              )
            })}
          </div>
        ) : null}

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
            ref={search}
            value={needle}
            onChange={(e) => setNeedle(e.target.value)}
            placeholder={`Find a ${tab === "repos" ? "repository" : tab === "status" ? "status" : "label"}`}
            /* Named on the control rather than in a legend nobody reads: a
               shortcut you have to be told about is a shortcut for one person. */
            title="⌘K"
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
                  {/*
                    The owner header is itself a toggle, and it carries the face.

                    The avatar goes here rather than on each row because the
                    list is already grouped by owner: repeated per row it would
                    be the same picture eight times, which is decoration. On the
                    header it does work — two owners are told apart by
                    recognition rather than by reading, which is exactly the
                    personal-versus-work split these filters exist for.

                    A stable URL off a name we already have, so nothing is
                    fetched to learn who someone is, and `size=64` into a 20px
                    box because a phone at 3x would otherwise show it soft.
                  */}
                  <OwnerHead owner={owner} entries={entries} />
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

        {/*
          Saving is the last thing you do, so it is the last thing here — and on
          a bottom sheet that also puts it where the thumb already is. Outside
          the scrolling list, so it is reachable without scrolling past
          twenty-two repositories, and at a fixed height so nothing above it
          moves when it changes state.
        */}
        <div className="flex h-[38px] shrink-0 items-center gap-1.5 border-t border-line-soft pt-2">
          {naming ? (
            <>
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
                className="h-[28px] min-w-0 flex-1 rounded-lg border border-line bg-panel-2 px-2 text-[12.5px] outline-none focus:border-accent"
              />
              <button
                type="button"
                onClick={save}
                className="h-[28px] shrink-0 rounded-lg border border-accent bg-accent-dim px-2.5 text-[12.5px] text-accent"
              >
                Save
              </button>
            </>
          ) : (
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
              className="h-[28px] w-full rounded-lg border border-dashed border-line text-[12.5px] text-fg-quiet transition-opacity hover:text-fg disabled:opacity-40 disabled:hover:text-fg-quiet"
            >
              Save this view
            </button>
          )}
        </div>
      </div>
    </>
  )
}
