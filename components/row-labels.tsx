"use client"

import { tip } from "@/components/tooltip"
import { useState } from "react"

import { useWritable } from "@/components/use-writable"

/*
 * The one write on the board: tap a label to take it off, or pick one to put on.
 *
 * Kept to a tap on purpose. A board's native write gesture is drag-and-drop,
 * which on a narrow screen is close to the worst gesture available — long-press,
 * drag across a container that itself scrolls, land on a target you cannot see.
 * A label is the same state change with none of that.
 *
 * The picker fetches a repo's labels on demand rather than up front: most rows
 * never get one applied, and asking for every repo's label list on every load
 * would be a request per repo to serve a rare action.
 */

type Props = {
  repo: string
  number: number
  labels: readonly string[]
  /* Corrects the row in place. Nothing on the board derives from labels, so a
     refetch here would spend 74 GraphQL points to redraw one chip. */
  onChanged: (
    repo: string,
    number: number,
    label: string,
    action: "add" | "remove",
  ) => void
}

const post = (body: unknown) =>
  fetch("/api/labels", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })

export const RowLabels = ({ repo, number, labels, onChanged }: Props) => {
  const [available, setAvailable] = useState<string[]>()
  const [busy, setBusy] = useState<string>()
  const [problem, setProblem] = useState<string>()

  /* Unknown counts as writable — see `use-writable.tsx`. The server still
     refuses a write we should not have offered; this only stops offering it. */
  const mayWrite = useWritable(repo)

  const change = async (label: string, action: "add" | "remove") => {
    setBusy(label)
    setProblem(undefined)
    try {
      const response = await post({ repo, number, label, action })
      if (!response.ok) {
        const { error } = (await response.json()) as { error?: string }
        return setProblem(error ?? "That did not work.")
      }
      setAvailable(undefined)
      onChanged(repo, number, label, action)
    } catch {
      /* The `!response.ok` branch above was careful and this one did not exist,
         so a write that failed on the network — the common case on a phone —
         cleared `busy` and said nothing. A control that ignores you is worse
         than one that refuses you. */
      setProblem("Could not reach GitHub. Nothing was changed.")
    } finally {
      setBusy(undefined)
    }
  }

  const openPicker = async () => {
    if (available) return setAvailable(undefined)

    const response = await fetch(
      `/api/labels?repo=${encodeURIComponent(repo)}`,
      { cache: "no-store" },
    ).catch(() => undefined)
    if (!response?.ok)
      return setProblem("Could not read this repo\u2019s labels.")

    const { labels: all } = (await response.json()) as {
      labels: { name: string }[]
    }
    setAvailable(all.map((l) => l.name).filter((n) => !labels.includes(n)))
  }

  return (
    <div className="mt-1 md:mt-1.5">
      <div className="flex flex-wrap items-center gap-1">
        {labels.map((label, i) =>
          mayWrite ? (
            <button
              key={label}
              type="button"
              onClick={() => void change(label, "remove")}
              disabled={busy === label}
              /* The chip's own text is the label, so without this the button's
                 accessible name is just the label — indistinguishable from the
                 read-only span beside it, and silent about what pressing does. */
              aria-label={`Remove ${label}`}
              {...tip(`Remove ${label}`)}
              className={`rounded-full border border-line px-2 py-px text-[10px] text-fg-quiet disabled:opacity-50 md:text-[11px] ${i > 1 ? "hidden md:inline-block" : ""}`}
            >
              {label}
              <span aria-hidden> ×</span>
            </button>
          ) : (
            /* Still worth reading, just not a button: removing is the same
               write as adding, so it fails for the same reason. */
            <span
              key={label}
              className={`rounded-full border border-line px-2 py-px text-[10px] text-fg-quiet md:text-[11px] ${i > 1 ? "hidden md:inline-block" : ""}`}
            >
              {label}
            </span>
          ),
        )}

        {labels.length > 2 ? (
          <span className="text-[10px] text-fg-quiet md:hidden">
            +{labels.length - 2}
          </span>
        ) : null}

        {/*
          Revealed rather than advertised, and never on a phone: the card is a
          tap target there, and a permanent control for a rare act doubles the
          noise on every row to serve one in twenty.

          And absent entirely where you cannot write. It used to be offered on
          every row, so a repo you only read answered the tap with "You cannot
          label a repository you do not have write access to" — after the
          request, after the wait, and after you had decided to do it. An
          affordance that fails on use is worse than one that is not there:
          absence is information, failure is only a rebuke. Removing labels is
          gated by the same fact, since it is the same write.
        */}
        {mayWrite ? (
          <button
            type="button"
            onClick={() => void openPicker()}
            aria-expanded={Boolean(available)}
            /* Its only text is a `+`. */
            aria-label="Add a label"
            {...tip("Add a label")}
            className="hidden rounded-full border border-line px-2 py-px text-[11px] text-fg-quiet opacity-0 transition-opacity focus:opacity-100 group-hover:opacity-100 md:inline-block"
          >
            +
          </button>
        ) : null}
      </div>

      {available ? (
        available.length ? (
          <div className="mt-1 flex flex-wrap gap-1">
            {available.map((label) => (
              <button
                key={label}
                type="button"
                onClick={() => void change(label, "add")}
                disabled={busy === label}
                className="rounded-full border border-dashed border-line px-2 py-px text-[11px] disabled:opacity-50"
              >
                {label}
              </button>
            ))}
          </div>
        ) : (
          <p className="mt-1 text-[11px] text-fg-quiet">
            No other labels in this repository.
          </p>
        )
      ) : null}

      {/* The glyph carries the failure as well as the colour — a colourblind
          reader gets the same message. */}
      {problem ? (
        <p className="mt-1 flex items-start gap-1 text-[11px] text-brass">
          <span aria-hidden>!</span>
          <span>{problem}</span>
        </p>
      ) : null}
    </div>
  )
}
