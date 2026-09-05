"use client"

import { useMemo, useState } from "react"

import { Ago } from "@/components/ago"
import { useInbox, type Liveness } from "@/components/use-inbox"
import { RowLabels } from "@/components/row-labels"
import { presentationFor } from "@/lib/sections"
import type { Inbox as InboxData, Row } from "@/lib/github"

/*
 * One view at two widths, not two products.
 *
 * A column is a device for peripheral vision — its worth is seeing the third
 * column while your hand is in the first. On a wide screen that is real. On a
 * 390pt phone you hold one column and a sliver, so you pay the whole cost of the
 * abstraction (fixed buckets, a horizontal axis to traverse, spatial memory
 * across a gesture) and collect none of the benefit.
 *
 * So the same board becomes a list: the columns turn into section headers, in
 * board order, with their counts. Deliberately NOT one column with scroll
 * snapping — that keeps the horizontal axis and then hides the counts behind a
 * gesture, so "how much is waiting on me" needs a journey where a header answers
 * it at a glance.
 */

const MOVE_GROUPS = [
  {
    id: "you" as const,
    title: "Your move",
    blurb: "Nothing moves here until you do something.",
  },
  {
    id: "them" as const,
    title: "Their move",
    blurb: "Waiting on someone else. Here so nothing goes quiet unnoticed.",
  },
]

/*
 * The one-word reason a row is in front of you.
 *
 * Without it a list of titles is undifferentiated, and the ordering reads as
 * arbitrary — the row has to say why it ranked where it did, or the ranking is
 * just an opinion nobody can check.
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
  return presentationFor(sectionKeyOf(row)).glyph === "○" ? "Issue" : "Open"
}

/** The presentation key for a source — `lib/sections.ts` owns how it looks. */
const SECTION_KEY: Record<string, string> = {
    myPRs: "open",
    reviewRequests: "review",
    reviewed: "reviewed",
    assigned: "assigned",
    repoIssues: "issues",
    authoredIssues: "issues",
    repoPRs: "incoming",
  recentlyDone: "done",
}

const sectionKeyOf = (row: Row): string => SECTION_KEY[row.source] ?? "open"

const LIVENESS_TEXT: Record<Liveness, string> = {
  live: "Live",
  refreshing: "Refreshing",
  stale: "May be out of date",
  offline: "Offline",
  expired: "Session expired",
}

/*
 * State gets a word as well as a colour. Two markers that differ only in hue are
 * one marker to a colourblind reader, and this line is the board saying whether
 * to trust itself — the last place to encode meaning in hue alone.
 */
const Liveness = ({ liveness, at }: { liveness: Liveness; at?: number }) => (
  <p className="flex items-center gap-1.5 text-[12px] text-fg-quiet">
    <span aria-hidden>
      {liveness === "live" ? "●" : liveness === "refreshing" ? "◐" : "◌"}
    </span>
    <span>{LIVENESS_TEXT[liveness]}</span>
    {at ? (
      <>
        <span aria-hidden>·</span>
        <span>
          as of <Ago iso={new Date(at).toISOString()} since={new Date(at).toISOString()} />
        </span>
      </>
    ) : null}
  </p>
)

/*
 * A card rather than one big link, because the row now has two jobs: open the
 * thing, and change a label on it. A <button> inside an <a> is invalid HTML and
 * browsers resolve it by making the whole card a link — so the title is the
 * link and the chips sit beside it.
 */
const RowCard = ({ row, onChanged }: { row: Row; onChanged: () => void }) => {
  const section = presentationFor(sectionKeyOf(row))

  return (
    <div className="rounded-lg border border-line bg-panel-2 p-3 focus-within:border-accent hover:border-accent">
      <p className="flex items-center gap-1.5 text-[12px] text-fg-quiet">
        <span aria-hidden>{section.glyph}</span>
        <span className="truncate">{row.repo}</span>
        <span aria-hidden>·</span>
        <span>#{row.number}</span>
      </p>

      <a
        href={row.url}
        target="_blank"
        rel="noreferrer"
        className="mt-1 block text-[14px] leading-snug hover:underline focus:underline focus:outline-none"
      >
        {row.title}
      </a>

      <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-fg-quiet">
        <span className="rounded border border-line px-1.5 py-px">
          {reasonFor(row)}
        </span>
        <span>{row.activityAge ?? row.age} ago</span>
      </p>

      <RowLabels
        repo={row.repo}
        number={row.number}
        labels={row.labels ?? []}
        onChanged={onChanged}
      />
    </div>
  )
}

const Section = ({
  id,
  rows,
  onChanged,
}: {
  id: string
  rows: Row[]
  onChanged: () => void
}) => {
  const presentation = presentationFor(id)
  const [open, setOpen] = useState(true)

  return (
    <section className="md:w-[320px] md:shrink-0">
      {/* The count lives in the header rather than behind a gesture: "how much
          is in review" is the question a board answers at a glance, and it is
          the one a single snapped column takes a journey to answer. */}
      <button
        type="button"
        onClick={() => setOpen((was) => !was)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 py-2 text-left text-[13px] font-medium"
      >
        <span aria-hidden>{presentation.glyph}</span>
        <span className="capitalize">{id}</span>
        <span className="text-fg-quiet">{rows.length}</span>
        <span className="ml-auto text-fg-quiet md:hidden" aria-hidden>
          {open ? "−" : "+"}
        </span>
      </button>

      {open ? (
        <div className="flex flex-col gap-2">
          {rows.length ? (
            rows.map((row) => (
              <RowCard key={row.url} row={row} onChanged={onChanged} />
            ))
          ) : (
            <p className="py-1 text-[13px] text-fg-quiet">
              {presentation.empty}
            </p>
          )}
        </div>
      ) : null}
    </section>
  )
}

export const Inbox = ({ initial }: { initial?: InboxData }) => {
  const { inbox, liveness, refresh } = useInbox(initial)

  const grouped = useMemo(() => {
    const rows = inbox?.rows ?? []
    return MOVE_GROUPS.map((group) => {
      const mine = rows.filter((row) => row.move === group.id)
      const sections = new Map<string, Row[]>()
      /* Section order follows the rows, which arrive already sorted by
         recency — so a section's position tracks what actually moved rather
         than a fixed taxonomy nobody chose. */
      for (const row of mine) {
        const key = sectionKeyOf(row)
        sections.set(key, [...(sections.get(key) ?? []), row])
      }
      return { ...group, count: mine.length, sections: [...sections] }
    })
  }, [inbox])

  return (
    <main className="mx-auto min-h-safe max-w-[1400px] p-4">
      <header className="flex items-baseline gap-3 pb-2">
        <h1 className="text-[17px] font-semibold">Your Move</h1>
        <Liveness liveness={liveness} at={inbox?.fetchedAt} />
        <button
          type="button"
          onClick={() => void refresh()}
          className="ml-auto rounded-lg border border-line px-2.5 py-1 text-[13px]"
        >
          Refresh
        </button>
      </header>

      {liveness === "expired" ? (
        <p className="rounded-lg border border-brass p-3 text-[13px]">
          <span aria-hidden>! </span>
          Your GitHub session has expired.{" "}
          <a className="underline" href="/api/auth/login">
            Sign in again
          </a>
          .
        </p>
      ) : null}

      {inbox?.failed.length ? (
        /* A partial answer is still worth rendering, but never silently — a
           board quietly missing a source looks exactly like a board with
           nothing in it. */
        <p className="mb-2 text-[12px] text-brass">
          <span aria-hidden>! </span>
          GitHub did not answer for: {inbox.failed.join(", ")}
        </p>
      ) : null}

      {grouped.map((group) => (
        <div key={group.id} className="pt-4">
          <h2 className="text-[15px] font-semibold">
            {group.title}{" "}
            <span className="font-normal text-fg-quiet">{group.count}</span>
          </h2>
          <p className="pb-1 text-[12px] text-fg-quiet">{group.blurb}</p>

          {/* Stacked on a phone, columns from `md` up. One grid, two shapes. */}
          <div className="flex flex-col md:flex-row md:gap-4 md:overflow-x-auto md:pb-2">
            {group.sections.length ? (
              group.sections.map(([id, rows]) => (
                <Section
                  key={id}
                  id={id}
                  rows={rows}
                  onChanged={() => void refresh()}
                />
              ))
            ) : (
              <p className="py-2 text-[13px] text-fg-quiet">
                {group.id === "you"
                  ? "Nothing is waiting on you."
                  : "Nothing outstanding elsewhere."}
              </p>
            )}
          </div>
        </div>
      ))}
    </main>
  )
}
