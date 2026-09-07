"use client"

import { useEffect, useRef, useState } from "react"

import { RowLabels } from "@/components/row-labels"
import type { OnLabelChange } from "@/components/board"
import { GitHubMark } from "@/components/github-mark"
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
 * Every width, which reverses an earlier call that was answering the wrong
 * question. "On a phone the native GitHub app does all of this better" is true
 * of the WORK — and this panel does not do the work. It does the verdict, which
 * GitHub states nowhere, and a verdict is worth most on a phone, in a queue,
 * where the alternative is an app switch per row.
 *
 * That was the real cost of sending a tap straight out: reading four rows meant
 * four round trips, a load each way and a place to find again. Now you decide
 * in here and leave only for the ones you are going to act on.
 *
 * A side panel rather than a centre modal on a desk, because the board is the
 * context you came from and blacking it out on a two-axis board costs you your
 * place. On a phone there is no context to preserve, so it takes the screen.
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

/*
 * Where the row opens.
 *
 * A side panel is still the default and still the argued-for one: the board is
 * the context you came from, and on something that scrolls in two axes,
 * blacking it out costs you your place. But that is a claim about the common
 * case, not about every case — a long description wants width, and a row you
 * are going to sit with wants the screen. Three answers, and you pick.
 *
 * Changeable from the panel itself as well as from the settings, because the
 * moment you know which one you wanted is the moment you are looking at the
 * wrong one. Changing it there also sets it, so the control teaches the setting
 * rather than competing with it.
 */
export type OpenMode = "side" | "modal" | "full" | "github"

/* `github` has no shell: choosing it means the panel is never opened at all,
   so the card behaves as the plain link it always was underneath. */
/*
 * Every shape here is `md:`-prefixed, and that is the whole of what makes the
 * phone case work. The base deliberately does NOT reset its inset above `md`:
 * its own inset is a `max-md` one, so there is nothing up there to undo — and
 * adding a reset did real damage, because two utilities of equal specificity
 * are resolved by their order in the GENERATED sheet, not by the order they
 * appear in the class string. Tailwind emits the reset after the zero, so the
 * base silently beat `modal` and `full` and both lost their positioning: the
 * modal had nothing left to centre against and collapsed.
 *
 * Written without naming the class, because Tailwind scans source text — a
 * class named in a COMMENT is emitted as though it were used. The base is `max-md:inset-0` — a real full screen — and
 * without the prefixes a "side panel" kept its `w-[min(620px,92vw)]` at 390px,
 * so the panel stopped 8% short and the board showed down the right edge.
 * Below `md` there is no shape to choose: it takes the screen.
 */
const SHELL: Record<Exclude<OpenMode, "github">, string> = {
  side: "md:inset-y-0 md:right-0 md:w-[min(620px,92vw)] md:border-l",
  modal:
    "md:inset-0 md:m-auto md:h-[min(86vh,820px)] md:w-[min(780px,92vw)] md:rounded-2xl md:border",
  full: "md:inset-0",
}

/*
 * A phone gets a modal, not a full screen.
 *
 * Full-bleed was the wrong read of "there is no context to preserve". There is:
 * a sliver of the blurred board at every edge is what says you are on top of
 * something and can get back to it. Edge to edge, the panel stops being a panel
 * and becomes a page, and a page has no obvious way out — which is a worse
 * answer on the device with no Escape key.
 */
const PHONE = "max-md:inset-3 max-md:rounded-2xl max-md:border"

const ENTER: Record<Exclude<OpenMode, "github">, string> = {
  side: "ym-in-side",
  modal: "ym-in-modal",
  full: "ym-in-fade",
}

const MODE_LABEL: Record<Exclude<OpenMode, "github">, string> = {
  side: "Side",
  modal: "Modal",
  full: "Full",
}

export const Detail = ({
  row,
  onClose,
  onLabelChange,
  mode,
  onMode,
}: {
  row: Row
  onClose: () => void
  onLabelChange: OnLabelChange
  /* Never `github` here: that mode means this component is not rendered. */
  mode: Exclude<OpenMode, "github">
  onMode: (mode: OpenMode) => void
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

  /*
   * Escape closes, and the browser's own back gesture does too — the parent
   * owns that, because it owns the URL.
   *
   * Tab stays inside. Without this the panel was a dialog by role only: focus
   * never entered it, so a keyboard reader who opened a row was still tabbing
   * through the board behind — reading one thing and steering another. And on
   * close, focus went to the top of the document rather than back to the card,
   * so every row read cost you your place in the grid.
   *
   * Hand-rolled rather than `<dialog>` because this is not always modal: as a
   * side panel the board behind stays deliberately readable and reachable, and
   * `showModal()` would make it inert. The trap is the price of that choice.
   */
  const panel = useRef<HTMLElement>(null)
  const cameFrom = useRef<HTMLElement | null>(null)

  useEffect(() => {
    cameFrom.current = document.activeElement as HTMLElement | null
    /* The heading rather than the first control: a screen reader should hear
       what this is before it hears what it can do about it. */
    requestAnimationFrame(() => panel.current?.focus({ preventScroll: true }))

    /*
     * `preventScroll` on both, and it is not a nicety.
     *
     * Focusing an element scrolls it into view by default — so returning focus
     * to the card you opened moved the board under it, and a mandatory snap
     * resolved that move to the nearest column start. Opening a ticket appeared
     * to send you back a column. The focus is the point; the scroll was never
     * asked for, and the board already remembers where it was.
     */
    return () => cameFrom.current?.focus?.({ preventScroll: true })
  }, [])

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") return onClose()
      if (e.key !== "Tab" || !panel.current) return

      const stops = panel.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input, [tabindex]:not([tabindex="-1"])',
      )
      const first = stops[0]
      const last = stops[stops.length - 1]
      if (!first || !last) return

      /* Only the two edges are handled; everything between them is the
         browser's own order, which is the one a reader expects. */
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
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
        /* The ground recedes as well as darkens. On a desk the board stays
           readable behind a side panel, which is the point of a side panel; on
           a phone the panel IS the screen, so a sharp board showing through the
           edges reads as a rendering fault rather than as context. The blur is
           dropped under reduced motion, where it is the most expensive thing
           on the page. */
        className="ym-backdrop ym-in-fade fixed inset-0 z-40 bg-black/50"
      />

      <aside
        ref={panel}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        aria-label={`${row.repo}#${row.number}`}
        /* Full screen below `md` regardless of the preference, which is a
           desk preference: at 390px a "side panel" at 92vw is a full screen
           wearing a border, and a modal is one with margins. */
        className={`fixed z-50 flex flex-col border-line bg-panel shadow-[0_30px_80px_-40px_rgba(0,0,0,.9)] ${PHONE} ${ENTER[mode]} ${SHELL[mode]}`}
      >
        <header
          className="flex items-start gap-3 border-b border-line-soft p-4"
          style={{ paddingTop: "max(1rem, env(safe-area-inset-top))" }}
        >
          <div className="min-w-0 flex-1">
            <p className="font-mono text-[12px] text-fg-quiet">
              {row.repo}#{row.number}
            </p>
            <h2 className="mt-1 text-pretty font-serif text-[20px] font-semibold leading-tight">
              {row.title}
            </h2>
          </div>

          {/* At the top of the ticket as well as in the settings, and the same
              choice in both places — the one you make here is remembered. */}
          <span className="hidden shrink-0 overflow-hidden rounded-lg border border-line lg:flex">
            {(["side", "modal", "full"] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => onMode(option)}
                aria-pressed={mode === option}
                title={`Open as ${MODE_LABEL[option].toLowerCase()}`}
                className={`px-2 py-1 text-[11.5px] ${
                  mode === option
                    ? "bg-accent-dim text-accent"
                    : "text-fg-quiet hover:text-fg"
                }`}
              >
                {MODE_LABEL[option]}
              </button>
            ))}
          </span>

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
                      {/*
                        Rendered, for the same reason the body is.

                        A bot comment is the worst case and the common one: they
                        arrive as `#### PR Summary`, backticked identifiers and
                        an `<!-- ai-pr-review-tool -->` marker, so unrendered
                        they were paying the full cost of markdown's syntax to
                        show none of its meaning. `lib/markdown.tsx` already
                        drops HTML comments — issue templates ship with them —
                        so the marker goes for free.

                        `line-clamp` cannot survive the switch: it needs a
                        `-webkit-box` of text, and this is now a block of
                        elements. A height cap with the list fade does the same
                        job and cuts between lines rather than through one.
                      */}
                      <div className="fade-b mt-0.5 max-h-[7.5rem] overflow-hidden text-[13.5px] leading-[1.5] text-fg-mute">
                        <Markdown source={c.body} />
                      </div>
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
        {/*
          Two exits, asymmetric on purpose: the work is elsewhere by design, and
          the labels are the only act available in place.

          Full width and thumb-height on a phone, because there it is not a
          footnote — it is the second half of the gesture. You read the verdict,
          and either you are done or you are going. `env()` on the padding
          because a full-screen panel escapes the body's safe-area inset, so
          without it this sits under the gesture bar.
        */}
        <footer
          className="flex flex-col gap-2 border-t border-line-soft p-3 md:flex-row md:items-center md:gap-3"
          style={{
            paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))",
          }}
        >
          <a
            href={row.url}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center gap-2 rounded-lg border border-accent bg-accent-dim px-3 py-2.5 text-center text-[15px] font-semibold text-accent md:py-1.5 md:text-[13.5px] md:font-normal"
          >
            {/*
              `currentColor`, so the mark is the same rose as the label rather
              than a second colour decision. The rule that a mark is never the
              accent is about not SPENDING the accent — here the button is
              already entirely accent, so the mark adds no rose that was not
              already on screen, and matching the label is what keeps it from
              reading as a separate object sitting inside a button.
            */}
            <GitHubMark className="size-4 shrink-0" />
            Open on GitHub ↗
          </a>
          <span className="hidden font-mono text-[11px] uppercase tracking-[0.12em] text-fg-quiet md:ml-auto md:inline">
            labels only
          </span>
        </footer>
      </aside>
    </>
  )
}
