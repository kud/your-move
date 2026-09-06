"use client"

import { useMemo, useState } from "react"

import type { Row } from "@/lib/github"

/*
 * Narrowing the board to a context you actually work in.
 *
 * One control in the header rather than a second rail: the section rail is
 * already a strip of chips, and a repo strip beneath it would compete with it
 * while still not holding fifteen repos.
 *
 * A native `popover` again — anchored from `md` up, the same element styled as a
 * bottom sheet below it. The browser owns Escape, click-outside, focus return
 * and top-layer rendering, which matters here because the board scrolls in both
 * axes and a tethered dropdown would be clipped by the column overflow.
 */

const ID = "repo-filter"

/** More than this and the list needs a way to search itself. */
const TYPEAHEAD_AFTER = 10

export type RepoCount = { repo: string; owner: string; count: number }

export const repoCounts = (rows: Row[]): RepoCount[] => {
  const counts = new Map<string, number>()
  for (const row of rows) counts.set(row.repo, (counts.get(row.repo) ?? 0) + 1)

  return (
    [...counts]
      .map(([repo, count]) => ({
        repo,
        owner: repo.split("/")[0] ?? repo,
        count,
      }))
      /* By count, not alphabetically. The repo you want to silence is almost
       always the noisy one, so it should be the one under your thumb. */
      .sort((a, b) => b.count - a.count || a.repo.localeCompare(b.repo))
  )
}

type Props = {
  repos: RepoCount[]
  selected: string[]
  onChange: (next: string[]) => void
}

export const RepoFilter = ({ repos, selected, onChange }: Props) => {
  const [needle, setNeedle] = useState("")

  const byOwner = useMemo(() => {
    const shown = needle
      ? repos.filter((r) => r.repo.toLowerCase().includes(needle.toLowerCase()))
      : repos

    const owners = new Map<string, RepoCount[]>()
    for (const entry of shown)
      owners.set(entry.owner, [...(owners.get(entry.owner) ?? []), entry])

    return [...owners].sort(
      (a, b) =>
        b[1].reduce((n, r) => n + r.count, 0) -
        a[1].reduce((n, r) => n + r.count, 0),
    )
  }, [repos, needle])

  const on = selected.length > 0
  const toggle = (repo: string) =>
    onChange(
      selected.includes(repo)
        ? selected.filter((r) => r !== repo)
        : [...selected, repo],
    )

  /* The owner header is itself a toggle, which gives the personal-versus-work
     split — the granularity that actually matters — without inventing a second
     concept or a second control. */
  const toggleOwner = (owner: string, all: RepoCount[]) => {
    const names = all.map((r) => r.repo)
    const every = names.every((n) => selected.includes(n))
    onChange(
      every
        ? selected.filter((r) => !names.includes(r))
        : [...new Set([...selected, ...names])],
    )
  }

  return (
    <>
      {/* The button is the primary "a filter is on" signal, before any banner. */}
      <button
        type="button"
        popoverTarget={ID}
        className={`rounded-lg border px-2.5 py-1 text-[13px] transition-colors ${
          on
            ? "border-accent bg-accent-dim text-fg"
            : "border-line text-fg-mute hover:text-fg"
        }`}
      >
        {on ? `${selected.length} of ${repos.length} repos` : "All repos"}
      </button>

      <div
        id={ID}
        popover="auto"
        className="m-auto max-h-[70dvh] w-[min(92vw,380px)] overflow-y-auto rounded-2xl border border-line bg-panel p-3 text-fg shadow-[0_30px_80px_-40px_rgba(0,0,0,.9)] backdrop:bg-black/60 md:max-h-[60dvh]"
      >
        <div className="flex items-center gap-2 pb-2">
          <b className="text-[15px] font-semibold">Repositories</b>
          {on ? (
            <button
              type="button"
              onClick={() => onChange([])}
              className="ml-auto text-[12px] text-accent hover:underline"
            >
              Clear
            </button>
          ) : null}
        </div>

        {repos.length > TYPEAHEAD_AFTER ? (
          <input
            type="search"
            value={needle}
            onChange={(e) => setNeedle(e.target.value)}
            placeholder="Find a repository"
            aria-label="Find a repository"
            className="mb-2 w-full rounded-lg border border-line bg-panel-2 px-2.5 py-1.5 text-[13px] outline-none focus:border-accent"
          />
        ) : null}

        {byOwner.map(([owner, entries]) => (
          <div key={owner} className="pb-2">
            <button
              type="button"
              onClick={() => toggleOwner(owner, entries)}
              className="w-full pb-1 text-left font-mono text-[11px] uppercase tracking-[0.12em] text-fg-quiet hover:text-fg-mute"
            >
              {owner}
            </button>

            {entries.map(({ repo, count }) => {
              const picked = selected.includes(repo)
              return (
                <button
                  key={repo}
                  type="button"
                  onClick={() => toggle(repo)}
                  aria-pressed={picked}
                  className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[13.5px] transition-colors ${
                    picked
                      ? "bg-accent-dim text-fg"
                      : "text-fg-mute hover:bg-raise"
                  }`}
                >
                  {/* Shape as well as colour: a tick, not a tint alone. */}
                  <span aria-hidden className="w-3 font-mono text-[12px]">
                    {picked ? "✓" : ""}
                  </span>
                  <span className="min-w-0 flex-1 truncate">
                    {repo.slice(owner.length + 1)}
                  </span>
                  {/* Without the count, unticking is guesswork — you cannot tell
                      whether it costs you two rows or forty. */}
                  <span className="font-mono text-[12.5px] tabular-nums text-fg-quiet">
                    {count}
                  </span>
                </button>
              )
            })}
          </div>
        ))}

        {byOwner.length === 0 ? (
          <p className="px-2 py-3 text-[13px] text-fg-quiet">
            No repository matches that.
          </p>
        ) : null}
      </div>
    </>
  )
}
