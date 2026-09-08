"use client"

import { useEffect, useMemo, useRef, useState } from "react"

import { REASON_TONE, reasonFor } from "@/components/board"
import { shortName } from "@/lib/order"
import { DOT } from "@/components/filters"
import type { Row } from "@/lib/github"

/*
 * ⌘K — go anywhere.
 *
 * This overturns the decision that used to sit in `filters.tsx`, which held
 * that a palette here would be "the second skin" of the keyboard-first TUI. The
 * argument that won: ⌘K on github.com is itself a palette, so the expectation
 * is set by the host this app is an inbox FOR, not imported from a sibling.
 *
 * The line that keeps this from being the filter sheet twice, and it is
 * absolute: **the launcher never filters.** The sheet searches facet NAMES and
 * selecting narrows the set; this searches row TITLES and selecting arrives at
 * one thing. Narrow versus arrive. The moment a repo or a label appears here as
 * something to tick, the two boxes have become one box rendered twice, and the
 * reason to have either disappears.
 *
 * `popover="auto"`, and here that is wanted rather than tolerated: an auto
 * popover closes every other one outside its ancestor chain, and this app has
 * three. The launcher is a summons — two stacked panels each holding a search
 * field is the worst outcome available. It also inherits light dismiss, the
 * backdrop, and the rules that switch the board behind it inert, none of which
 * would exist under `manual`.
 */

export const LAUNCHER_ID = "ym-launcher"

const CAP = 8
const EMPTY_ROWS = 5

export type Command = { id: string; label: string; run: () => void }

type Item =
  | { kind: "row"; row: Row }
  | { kind: "command"; command: Command }

const KIND: Record<Row["kind"], string> = { pr: "PR", issue: "ISSUE" }

export const Launcher = ({
  rows,
  commands,
  onOpen,
}: {
  rows: Row[]
  commands: Command[]
  onOpen: (row: Row) => void
}) => {
  const [needle, setNeedle] = useState("")
  const [cursor, setCursor] = useState(0)
  const box = useRef<HTMLDivElement>(null)
  const field = useRef<HTMLInputElement>(null)

  const q = needle.trim().toLowerCase()

  /*
   * Ranked, not grouped, and the order is the board's own: a prefix match beats
   * a substring, `your move` beats `their move` — which is the CLAUDE.md
   * constraint and applies here exactly as it does on the board — then recency.
   */
  const hits = useMemo(() => {
    if (!q)
      return rows.filter((r) => r.move === "you").slice(0, EMPTY_ROWS)
    const scored = rows
      .map((row) => {
        const title = row.title.toLowerCase()
        const at = title.indexOf(q)
        if (at < 0) return undefined
        return { row, rank: (at === 0 ? 0 : 1) + (row.move === "you" ? 0 : 2) }
      })
      .filter((x): x is { row: Row; rank: number } => Boolean(x))
    return scored.sort((a, b) => a.rank - b.rank).map((x) => x.row)
  }, [rows, q])

  const shownRows = hits.slice(0, CAP)
  const shownCommands = useMemo(
    () =>
      q
        ? commands.filter((c) => c.label.toLowerCase().includes(q))
        : commands,
    [commands, q],
  )

  const items: Item[] = [
    ...shownRows.map((row) => ({ kind: "row" as const, row })),
    ...shownCommands.map((command) => ({ kind: "command" as const, command })),
  ]

  useEffect(() => setCursor(0), [needle])

  const run = (item: Item) => {
    box.current?.hidePopover?.()
    if (item.kind === "command") item.command.run()
    else onOpen(item.row)
  }

  const keys = (e: React.KeyboardEvent) => {
    /* One focusable thing by design — the rows are `option`s, not tab stops. */
    if (e.key === "Tab") return e.preventDefault()

    if (e.key === "Escape" && needle) {
      /* Two stages, and the first has to be taken from the browser: a native
         popover closes on Escape, and clearing a query you are still refining
         is the more useful first press. */
      e.preventDefault()
      e.stopPropagation()
      return setNeedle("")
    }

    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault()
      if (!items.length) return
      const step = e.key === "ArrowDown" ? 1 : -1
      if (e.metaKey || e.ctrlKey)
        return setCursor(step > 0 ? items.length - 1 : 0)
      return setCursor((was) => (was + step + items.length) % items.length)
    }

    if (e.key === "Enter") {
      const item = items[cursor]
      if (!item) return
      e.preventDefault()
      /* The one escape hatch, on the modifier links already use. */
      if ((e.metaKey || e.shiftKey) && item.kind === "row") {
        box.current?.hidePopover?.()
        window.open(item.row.url, "_blank", "noreferrer")
        return
      }
      run(item)
    }
  }

  /*
   * Deliberately does NOT early-return when another popover is open: the
   * launcher is a summons, and `auto` dismisses whatever was up on its own.
   * The guard that IS needed is the text-field one — otherwise ⌘K inside this
   * component's own search re-fires the handler.
   */
  useEffect(() => {
    const open = (event: KeyboardEvent) => {
      if (event.key !== "k" || !(event.metaKey || event.ctrlKey)) return
      event.preventDefault()
      const panel = document.getElementById(LAUNCHER_ID)
      if (!panel?.matches(":popover-open")) panel?.showPopover()
      requestAnimationFrame(() => field.current?.select())
    }
    addEventListener("keydown", open)
    return () => removeEventListener("keydown", open)
  }, [])

  const heading =
    "px-2 pb-1 pt-2 font-mono text-[10px] uppercase tracking-[0.14em] text-fg-quiet"

  return (
    <div
      ref={box}
      id={LAUNCHER_ID}
      popover="auto"
      onToggle={(e) => {
        if ((e as unknown as { newState: string }).newState !== "open") return
        setNeedle("")
        setCursor(0)
        requestAnimationFrame(() => field.current?.focus())
      }}
      className="ym-cmd fixed inset-x-0 top-0 m-0 w-full rounded-b-2xl border border-line bg-panel p-2 text-fg shadow-[0_30px_80px_-40px_rgba(0,0,0,.9)] backdrop:bg-black/60 md:inset-x-auto md:left-1/2 md:top-[12vh] md:w-[min(92vw,560px)] md:rounded-2xl"
      style={{ paddingTop: "max(0.5rem, env(safe-area-inset-top))" }}
    >
      <input
        ref={field}
        type="search"
        role="combobox"
        aria-expanded
        aria-controls={`${LAUNCHER_ID}-list`}
        aria-label="Find anything on the board"
        value={needle}
        onChange={(e) => setNeedle(e.target.value)}
        onKeyDown={keys}
        placeholder="Find anything on the board"
        className="w-full rounded-xl border border-line bg-panel-2 px-3 py-2.5 text-[15px] outline-none focus:border-accent"
      />

      <div
        id={`${LAUNCHER_ID}-list`}
        role="listbox"
        className="max-h-[min(52vh,420px)] overflow-y-auto"
      >
        {shownRows.length ? (
          <>
            {/* A heading only when there is more than one group — over the sole
                group it is ceremony. */}
            {shownCommands.length ? (
              <p className={heading}>{q ? "On the board" : "Your move"}</p>
            ) : null}
            {shownRows.map((row, i) => (
              <Line
                key={row.url}
                selected={cursor === i}
                onSelect={() => run({ kind: "row", row })}
                onHover={() => setCursor(i)}
                rail={
                  <>
                    <span
                      aria-hidden
                      className={`size-1.5 shrink-0 rounded-full ${DOT[REASON_TONE[reasonFor(row)] ?? "slate"] ?? DOT.slate}`}
                    />
                    <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-fg-quiet">
                      {KIND[row.kind]}
                    </span>
                  </>
                }
                title={row.title}
                trail={shortName(row.repo)}
              />
            ))}
          </>
        ) : null}

        {shownCommands.length ? (
          <>
            {shownRows.length ? <p className={heading}>Actions</p> : null}
            {shownCommands.map((command, i) => {
              const at = shownRows.length + i
              return (
                <Line
                  key={command.id}
                  selected={cursor === at}
                  onSelect={() => run({ kind: "command", command })}
                  onHover={() => setCursor(at)}
                  rail={<span aria-hidden className="w-9" />}
                  title={command.label}
                  muted
                />
              )
            })}
          </>
        ) : null}

        {hits.length > CAP ? (
          <p className="px-2 pt-1 text-[11.5px] text-fg-quiet">
            +{hits.length - CAP} more — keep typing
          </p>
        ) : null}

        {!items.length ? (
          <p className="px-2 py-3 text-[13px] text-fg-quiet">
            {q ? "Nothing matches that." : "Nothing needs you. Type to find anything."}
          </p>
        ) : null}
      </div>
    </div>
  )
}

/*
 * The cursor is `bg-raise` plus a 2px bar, never `bg-accent-dim`.
 *
 * Rose means "this needs you" on this board — the arrival pulse, the your-move
 * stripe, the header count. Spending it on a cursor that moves on every arrow
 * press devalues all three. The bar is shape rather than hue, which is the
 * board's own rule, and it is reserved on every row so nothing shifts as the
 * cursor travels. No transition on it either: held down, `↓` would smear.
 */
const Line = ({
  selected,
  onSelect,
  onHover,
  rail,
  title,
  trail,
  muted,
}: {
  selected: boolean
  onSelect: () => void
  onHover: () => void
  rail: React.ReactNode
  title: string
  trail?: string
  muted?: boolean
}) => (
  <button
    type="button"
    role="option"
    aria-selected={selected}
    onClick={onSelect}
    onPointerMove={onHover}
    className={`flex w-full items-center gap-2 rounded-lg border-l-2 px-2 py-2 text-left text-[13.5px] ${
      selected
        ? "border-accent bg-raise text-fg"
        : `border-transparent hover:bg-raise ${muted ? "text-fg-mute" : "text-fg"}`
    }`}
  >
    <span className="flex w-14 shrink-0 items-center gap-2">{rail}</span>
    <span className="min-w-0 flex-1 truncate">{title}</span>
    {trail ? (
      <span className="max-w-[38%] shrink-0 truncate font-mono text-[11.5px] text-fg-quiet">
        {trail}
      </span>
    ) : null}
  </button>
)
