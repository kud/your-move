"use client"

import { useState } from "react"

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
  /* So the list can re-rank: applying a label can change whose move it is, which
     is the whole reason labels are worth having here. */
  onChanged: () => void
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
      onChanged()
    } finally {
      setBusy(undefined)
    }
  }

  const openPicker = async () => {
    if (available) return setAvailable(undefined)

    const response = await fetch(
      `/api/labels?repo=${encodeURIComponent(repo)}`,
      { cache: "no-store" },
    )
    if (!response.ok) return setProblem("Could not read this repo's labels.")

    const { labels: all } = (await response.json()) as {
      labels: { name: string }[]
    }
    setAvailable(all.map((l) => l.name).filter((n) => !labels.includes(n)))
  }

  return (
    <div className="mt-1 md:mt-1.5">
      <div className="flex flex-wrap items-center gap-1">
        {labels.map((label, i) => (
          <button
            key={label}
            type="button"
            onClick={() => void change(label, "remove")}
            disabled={busy === label}
            title={`Remove ${label}`}
            className={`rounded-full border border-line px-2 py-px text-[10px] text-fg-quiet disabled:opacity-50 md:text-[11px] ${i > 1 ? "hidden md:inline-block" : ""}`}
          >
            {label}
            <span aria-hidden> ×</span>
          </button>
        ))}

        {labels.length > 2 ? (
          <span className="text-[10px] text-fg-quiet md:hidden">
            +{labels.length - 2}
          </span>
        ) : null}

        {/* Revealed rather than advertised, and never on a phone: the card is a
            tap target there, and a permanent control for a rare act doubles the
            noise on every row to serve one in twenty. */}
        <button
          type="button"
          onClick={() => void openPicker()}
          aria-expanded={Boolean(available)}
          title="Add a label"
          className="hidden rounded-full border border-line px-2 py-px text-[11px] text-fg-quiet opacity-0 transition-opacity focus:opacity-100 group-hover:opacity-100 md:inline-block"
        >
          +
        </button>
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
