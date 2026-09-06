"use client"

import { useEffect, useState } from "react"

import { RowLabels } from "@/components/row-labels"
import type { OnLabelChange } from "@/components/board"
import { Markdown } from "@/lib/markdown"
import type { Row } from "@/lib/github"

/*
 * One row, in enough detail to decide.
 *
 * The principle, written here because a list of exclusions erodes one request
 * at a time and a principle does not:
 *
 *   This surface exists to let you DECIDE, not to let you work. Everything on
 *   it serves "is this mine, and do I act now?" Anything that helps you do the
 *   work belongs on GitHub.
 *
 * So there is no diff, no file list, no comment box, no approve or merge, no
 * full thread, no reactions, no timeline. The bright line is the diff: the
 * moment you can read one here, you are reviewing here, and the app is a worse
 * GitHub client rather than a better inbox.
 *
 * Desktop only, and that is his call rather than an omission — on a phone the
 * native GitHub app does all of this better, and a card tap goes there instead.
 * A side panel rather than a centre modal, because the board is the context you
 * came from and on a board that scrolls horizontally, blacking it out costs you
 * your place.
 */

type Detail = {
  kind: "pr" | "issue"
  number: number
  title: string
  url: string
  state: string
  isDraft: boolean
  mergeable: string | null
  reviewDecision: string | null
  author?: string
  body: string
  labels: string[]
  unresolved: number
  checks: { name: string; state: string; url: string | null }[]
  reviews: { login: string; state: string }[]
  comments: { login: string; at: string; body: string }[]
}

const CHECK_GLYPH = (state: string) =>
  /SUCCESS|NEUTRAL|SKIPPED/i.test(state)
    ? { glyph: "✓", tone: "text-sage" }
    : /FAIL|ERROR|TIMED|CANCEL/i.test(state)
      ? { glyph: "✕", tone: "text-accent" }
      : { glyph: "◌", tone: "text-brass" }

/* Failures first, then the count of everything else — five red checks are worth
   five lines; twenty green ones are worth a number. */
const CHECK_CAP = 5

const REVIEW_WORD: Record<string, string> = {
  APPROVED: "approved",
  CHANGES_REQUESTED: "asked for changes",
  DISMISSED: "review dismissed",
  PENDING: "is reviewing",
}

/*
 * The verdict, in full words rather than the card's compressed chip.
 *
 * This is the reason the panel is ours rather than a worse GitHub, and neither
 * GitHub nor the board states it this plainly. If only one thing shipped here,
 * it would be this line.
 */
const verdictFor = (row: Row, detail?: Detail) => {
  const yours = row.move === "you"
  const failed = detail?.checks.filter((c) =>
    /FAIL|ERROR|TIMED|CANCEL/i.test(c.state),
  ).length

  const because =
    row.health === "ci-fail"
      ? `CI failing${failed ? ` on ${failed} check${failed === 1 ? "" : "s"}` : ""}`
      : row.health === "conflict"
        ? "Conflicts with the base branch"
        : row.health === "changes-req"
          ? "Changes requested"
          : row.health === "threads"
            ? `${row.unresolved} unresolved thread${row.unresolved === 1 ? "" : "s"}`
            : row.source === "reviewRequests"
              ? "Your review was requested"
              : row.health === "approved"
                ? "Approved and ready"
                : row.health === "merged"
                  ? "Merged"
                  : row.health === "closed"
                    ? "Closed"
                    : row.health === "draft"
                      ? "Still a draft"
                      : row.kind === "issue"
                        ? "Open issue"
                        : "Open"

  return {
    because,
    move: yours ? "your move" : "their move",
    tone: yours
      ? "border-accent bg-accent-dim text-accent"
      : "border-line bg-panel-2 text-fg-mute",
    glyph: yours ? "!" : "◌",
  }
}

export const Detail = ({
  row,
  onClose,
  onLabelChange,
}: {
  row: Row
  onClose: () => void
  onLabelChange: OnLabelChange
}) => {
  const [detail, setDetail] = useState<Detail>()
  const [failed, setFailed] = useState(false)
  const [wholeBody, setWholeBody] = useState(false)

  useEffect(() => {
    let live = true
    setDetail(undefined)
    setFailed(false)

    fetch(
      `/api/row?repo=${encodeURIComponent(row.repo)}&number=${row.number}`,
      { cache: "no-store" },
    )
      .then((r) =>
        r.ok ? r.json() : Promise.reject(new Error(String(r.status))),
      )
      .then((d: Detail) => live && setDetail(d))
      .catch(() => live && setFailed(true))

    return () => {
      live = false
    }
  }, [row.repo, row.number])

  /* Escape closes, and the browser's own back gesture does too — the parent
     owns that, because it owns the URL. */
  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose()
    document.addEventListener("keydown", key)
    return () => document.removeEventListener("keydown", key)
  }, [onClose])

  const verdict = verdictFor(row, detail)
  const failures = detail?.checks.filter((c) =>
    /FAIL|ERROR|TIMED|CANCEL/i.test(c.state),
  )
  const rest = (detail?.checks.length ?? 0) - (failures?.length ?? 0)

  const lines = detail?.body.split("\n") ?? []
  const long = lines.length > 12

  return (
    <>
      {/* The board stays visible and readable behind: it is the context you
          came from, not something to blank out. */}
      <div
        aria-hidden
        onClick={onClose}
        className="fixed inset-0 z-40 bg-black/40"
      />

      <aside
        role="dialog"
        aria-label={`${row.repo}#${row.number}`}
        className="fixed inset-y-0 right-0 z-50 flex w-[min(620px,92vw)] flex-col border-l border-line bg-panel shadow-[-30px_0_80px_-40px_rgba(0,0,0,.9)]"
      >
        <header className="flex items-start gap-3 border-b border-line-soft p-4">
          <div className="min-w-0 flex-1">
            <p className="font-mono text-[12px] text-fg-quiet">
              {row.repo}#{row.number}
            </p>
            <h2 className="mt-1 text-pretty font-serif text-[20px] font-semibold leading-tight">
              {row.title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid size-8 shrink-0 place-items-center rounded-lg border border-line text-fg-quiet hover:text-fg"
          >
            ✕
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-4">
          {/* Band one, and the most prominent thing on the panel. */}
          <p
            className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-[14px] ${verdict.tone}`}
          >
            <span aria-hidden>{verdict.glyph}</span>
            <span>
              {verdict.because} ·{" "}
              <b className="font-semibold">{verdict.move}</b>
            </span>
          </p>

          <div className="mt-3">
            <RowLabels
              repo={row.repo}
              number={row.number}
              labels={detail?.labels ?? row.labels ?? []}
              onChanged={onLabelChange}
            />
          </div>

          {failed ? (
            <p className="mt-4 text-[13px] text-brass">
              <span aria-hidden>! </span>
              Could not read the detail. The row above is still what the board
              knows.
            </p>
          ) : !detail ? (
            /* Everything already in hand is rendered above; only what needs a
               request shimmers. The reference pane shimmered its own heading
               despite holding the title, and visibly re-rendered under you. */
            <div className="mt-4 flex flex-col gap-2">
              <div className="shimmer h-4 w-1/3 rounded bg-panel-2" />
              <div className="shimmer h-16 rounded bg-panel-2" />
              <div className="shimmer h-16 rounded bg-panel-2" />
            </div>
          ) : (
            <>
              {/* The evidence for the verdict — structured, never a feed. */}
              {detail.checks.length || detail.reviews.length ? (
                <section className="mt-4">
                  <h3 className="pb-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-fg-quiet">
                    Where it stands
                  </h3>

                  {(failures ?? []).slice(0, CHECK_CAP).map((c) => {
                    const g = CHECK_GLYPH(c.state)
                    return (
                      <p
                        key={c.name}
                        className="flex items-center gap-2 py-0.5 text-[13px]"
                      >
                        <span aria-hidden className={g.tone}>
                          {g.glyph}
                        </span>
                        <span className="min-w-0 truncate">{c.name}</span>
                      </p>
                    )
                  })}
                  {rest > 0 ? (
                    <p className="py-0.5 text-[13px] text-fg-quiet">
                      <span aria-hidden className="text-sage">
                        ✓{" "}
                      </span>
                      and {rest} other check{rest === 1 ? "" : "s"}
                    </p>
                  ) : null}

                  {detail.reviews.map((r) => (
                    <p
                      key={`${r.login}-${r.state}`}
                      className="py-0.5 text-[13px] text-fg-mute"
                    >
                      <span aria-hidden>◆ </span>@{r.login}{" "}
                      {REVIEW_WORD[r.state] ?? r.state.toLowerCase()}
                    </p>
                  ))}

                  {detail.mergeable === "CONFLICTING" ? (
                    <p className="py-0.5 text-[13px] text-accent">
                      <span aria-hidden>✕ </span>Conflicts with the base branch
                    </p>
                  ) : null}
                  {detail.unresolved ? (
                    <p className="py-0.5 text-[13px] text-fg-mute">
                      <span aria-hidden>◇ </span>
                      {detail.unresolved} unresolved thread
                      {detail.unresolved === 1 ? "" : "s"}
                    </p>
                  ) : null}
                </section>
              ) : null}

              {detail.body.trim() ? (
                <section className="mt-4">
                  <h3 className="pb-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-fg-quiet">
                    What it says
                  </h3>
                  {/*
                    Rendered, but only part way.

                    This was deliberately plain text, on the reasoning that
                    rendering markdown invites images and tables and turns the
                    panel into a reader. The reasoning was right about the
                    destination and wrong about the road: unrendered, a
                    description arrives as `### 📄 Description` and backticked
                    identifiers, so the noise it was meant to avoid was being
                    paid up front, in every body, to prevent a thing that had
                    not happened.

                    `lib/markdown.tsx` draws the line where the old comment
                    wanted it — headings, emphasis, code, lists, quotes, links
                    in; images, tables and HTML out — rather than at "render
                    nothing".
                  */}
                  <Markdown
                    source={
                      wholeBody || !long
                        ? detail.body
                        : lines.slice(0, 12).join("\n")
                    }
                  />
                  {long && !wholeBody ? (
                    <button
                      type="button"
                      onClick={() => setWholeBody(true)}
                      className="mt-1 text-[12.5px] text-accent hover:underline"
                    >
                      Show the rest
                    </button>
                  ) : null}
                </section>
              ) : null}

              {detail.comments.length ? (
                <section className="mt-4">
                  <h3 className="pb-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-fg-quiet">
                    Last said
                  </h3>
                  {[...detail.comments].reverse().map((c, i) => (
                    <div
                      key={`${c.login}-${i}`}
                      className="border-t border-line-soft py-2 first:border-t-0"
                    >
                      <p className="text-[12px] text-fg-quiet">@{c.login}</p>
                      <p className="mt-0.5 line-clamp-4 whitespace-pre-wrap text-[13.5px] leading-[1.5] text-fg-mute">
                        {c.body}
                      </p>
                    </div>
                  ))}
                  <p className="pt-1 text-[12px] text-fg-quiet">
                    The rest of the conversation is on GitHub.
                  </p>
                </section>
              ) : null}
            </>
          )}
        </div>

        {/* Two exits, asymmetric on purpose: the work is elsewhere by design,
            and the labels are the only act available in place. */}
        <footer className="flex items-center gap-3 border-t border-line-soft p-3">
          <a
            href={row.url}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg border border-accent bg-accent-dim px-3 py-1.5 text-[13.5px] text-accent"
          >
            Open on GitHub ↗
          </a>
          <span className="ml-auto font-mono text-[11px] uppercase tracking-[0.12em] text-fg-quiet">
            labels only
          </span>
        </footer>
      </aside>
    </>
  )
}
