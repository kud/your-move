"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import {
  COLUMNS,
  DONE,
  Swimlanes,
  reasonFor,
  sectionOf,
  shortName,
  type Lane,
} from "@/components/board"
import { Detail, type OpenMode } from "@/components/detail"
import { Mark } from "@/components/mark"
import { Menu } from "@/components/menu"
import {
  Filters,
  countPicks,
  labelCounts,
  repoCounts,
  statusCounts,
  type Picks,
} from "@/components/filters"
import { SectionMark } from "@/components/section-mark"
import { Sky } from "@/components/sky"
import { useNotifier } from "@/components/use-notifier"
import { WritableRepos } from "@/components/use-writable"
import { useScrollMemory } from "@/components/use-scroll-memory"
import { unlockChime } from "@/lib/chime"
import { useInbox, type Liveness } from "@/components/use-inbox"
import { byCellOrder } from "@/lib/order"
import { presentationFor } from "@/lib/sections"
import { decodeShare, readViews, writeViews, type View } from "@/lib/views"
import type { Inbox as InboxData, Row } from "@/lib/github"

/*
 * The page around the board: header, honesty banners, filter, and the rail.
 *
 * The board itself lives in `board.tsx` in two compositions — a swimlane grid on
 * a desk, a vertical stack on a phone — because they are genuinely different
 * layouts rather than one layout at two widths, and pretending otherwise is what
 * produced the previous three attempts.
 */

const LIVENESS_TEXT: Record<Liveness, string> = {
  live: "Live",
  refreshing: "Refreshing",
  stale: "May be out of date",
  offline: "Offline",
  expired: "Session expired",
}

export const Inbox = ({ initial }: { initial?: InboxData }) => {
  /* Declared before the hook that consumes it. */
  const [doneDays, setDoneDays] = useState<7 | 14 | 30>(7)
  /* `owner/repo#number`, or nothing. */
  const [open, setOpen] = useState<string>()
  const [notify, setNotify] = useState(false)
  const [openMode, setOpenMode] = useState<OpenMode>("side")
  const [views, setViews] = useState<View[]>([])
  const [order, setOrder] = useState<"urgency" | "name">("urgency")
  const [sound, setSound] = useState(false)

  useEffect(() => {
    try {
      setNotify(localStorage.getItem("ym:notify") === "1")
      setSound(localStorage.getItem("ym:sound") === "1")
      const saved = localStorage.getItem("ym:open")
      if (
        saved === "side" ||
        saved === "modal" ||
        saved === "full" ||
        saved === "github"
      )
        setOpenMode(saved)
      const kept = readViews()

      /*
       * A shared link merges into what is already here rather than replacing
       * it, by name, exactly as the file import does — arriving on a second
       * device should add what is missing, not erase what is there.
       *
       * The fragment is stripped afterwards so a reload does not re-apply it,
       * and so the link does not sit in the address bar carrying repository
       * names for the next person who looks over your shoulder.
       */
      const shared = location.hash.startsWith("#views=")
        ? decodeShare(location.hash.slice("#views=".length))
        : []

      if (shared.length) {
        const names = new Set(shared.map((v) => v.name))
        const merged = [...kept.filter((v) => !names.has(v.name)), ...shared]
        setViews(merged)
        writeViews(merged)
        history.replaceState(null, "", location.pathname + location.search)
      } else {
        setViews(kept)
      }
      const how = localStorage.getItem("ym:order")
      if (how === "name" || how === "urgency") setOrder(how)
    } catch {}
  }, [])
  const { inbox, liveness, refresh, applyLabel, age } = useInbox(
    initial,
    doneDays,
  )
  const [picks, setPicks] = useState<Picks>({
    repos: [],
    status: [],
    labels: [],
    move: [],
  })
  const [active, setActive] = useState<string>()
  const [folded, setFolded] = useState<Set<string>>(new Set())

  const scroller = useRef<HTMLDivElement>(null)
  const rail = useRef<HTMLElement>(null)
  const anchors = useRef(new Map<string, HTMLElement>())

  const register = useCallback((id: string, el: HTMLElement | null) => {
    if (el) anchors.current.set(id, el)
    else anchors.current.delete(id)
  }, [])

  /* Which projects are folded is a per-device convenience, not shared state:
     it belongs in this browser and nowhere else. */
  useEffect(() => {
    try {
      const saved = localStorage.getItem("ym:folded")
      if (saved) setFolded(new Set(JSON.parse(saved) as string[]))
    } catch {
      /* A private window, cleared site data, or storage refused outright — an
         unfolded board is the correct fallback and needs no explanation. */
    }
  }, [])

  /* Written on change rather than on unload: a phone is closed by being taken
     away, and `beforeunload` is the one event you cannot rely on there. */
  const changeViews = useCallback((next: View[]) => {
    setViews(next)
    writeViews(next)
  }, [])

  const chooseOrder = useCallback((next: "urgency" | "name") => {
    setOrder(next)
    try {
      localStorage.setItem("ym:order", next)
    } catch {}
  }, [])

  const chooseOpenMode = useCallback((next: OpenMode) => {
    setOpenMode(next)
    try {
      localStorage.setItem("ym:open", next)
    } catch {}
  }, [])

  const fold = useCallback((repo: string) => {
    setFolded((was) => {
      const next = new Set(was)
      if (next.has(repo)) next.delete(repo)
      else next.add(repo)
      try {
        localStorage.setItem("ym:folded", JSON.stringify([...next]))
      } catch {}
      return next
    })
  }, [])

  /* Restored from and written back to the URL, so a filtered board is
     shareable and can be installed to a home screen as its own view — one per
     facet, so a link says which dimension it narrowed. */
  useEffect(() => {
    const query = new URLSearchParams(location.search)
    const read = (key: string) =>
      (query.get(key) ?? "").split(",").filter(Boolean)
    setPicks({
      repos: read("repos"),
      status: read("status"),
      labels: read("labels"),
      move: read("move"),
    })
  }, [])

  useEffect(() => {
    const url = new URL(location.href)
    for (const key of ["repos", "status", "labels", "move"] as const) {
      if (picks[key].length) url.searchParams.set(key, picks[key].join(","))
      else url.searchParams.delete(key)
    }
    history.replaceState(null, "", url)
  }, [picks])

  const all = useMemo(() => inbox?.rows ?? [], [inbox])
  const repos = useMemo(() => repoCounts(all), [all])
  const status = useMemo(() => statusCounts(all, reasonFor), [all])
  const labels = useMemo(() => labelCounts(all), [all])
  const filtering = countPicks(picks) > 0

  /*
   * AND across facets, OR within one — the reading nobody has to be told.
   * Two repos means "either of these"; a repo and a status means "in that repo
   * AND in that state". Counted against the UNFILTERED rows above, so every
   * facet always offers what it would cost you rather than what is left after
   * the other facets have had their say.
   */
  const shown = useMemo(
    () =>
      !filtering
        ? all
        : all.filter(
            (r) =>
              (!picks.repos.length || picks.repos.includes(r.repo)) &&
              (!picks.status.length || picks.status.includes(reasonFor(r))) &&
              (!picks.labels.length ||
                (r.labels ?? []).some((l) => picks.labels.includes(l))) &&
              (!picks.move.length || picks.move.includes(r.move)),
          ),
    [all, picks, filtering],
  )

  /*
   * Lanes ordered by urgency: the projects that want you first. With the
   * horizontal axis now fixed furniture, this is the only ordering decision
   * left, and it stops a long list of projects burying the two that matter.
   * You still find a project by reading names down the left rather than by
   * remembering a position, which is what makes a moving order survivable.
   */
  const lanes = useMemo((): Lane[] => {
    const byRepo = new Map<string, Row[]>()
    for (const r of shown)
      byRepo.set(r.repo, [...(byRepo.get(r.repo) ?? []), r])

    return (
      [...byRepo]
        .map(([repo, rows]): Lane => {
          const cells = new Map<string, Row[]>()
          for (const r of rows) {
            const key = sectionOf(r)
            cells.set(key, [...(cells.get(key) ?? []), r])
          }
          /* Yours first, drafts last within their band, then recency. The rule
           and the reasoning behind the middle key live in `lib/order.ts`. */
          for (const [key, rs] of cells)
            cells.set(key, [...rs].sort(byCellOrder))

          return {
            repo,
            cells,
            total: rows.length,
            yours: rows.filter((r) => r.move === "you").length,
          }
        })
        /*
         * Urgency by default, and that is the app's name rather than an arbitrary
         * choice: Your Move puts the thing that wants you at position one. Sorted
         * by name it would be a repository list, and there are a great many
         * repository lists.
         *
         * The alternative exists for the opposite want — a project always being
         * in the same place, for when you arrive looking for one by name rather
         * than reading down what is in front of you. By the name you can SEE,
         * not `owner/repo`, since the owner is not on screen.
         *
         * Two states only. A third dynamic order — "recently active" — would
         * deliver none of the stability that motivates the second one, and would
         * need "active by whom, on what" answered first: a data decision wearing
         * a sort's costume. Theo's call.
         */
        .sort((a, b) =>
          order === "name"
            ? shortName(a.repo).localeCompare(shortName(b.repo))
            : Number(b.yours > 0) - Number(a.yours > 0) ||
              b.yours - a.yours ||
              b.total - a.total,
        )
    )
  }, [shown, order])

  /* Tapping a card leaves the app entirely on a phone; this is what brings you
     back to the same place rather than to the first column. */
  useScrollMemory(scroller, lanes)

  /*
   * Rows that changed column since the last read.
   *
   * Deliberately an ARRIVAL rather than a journey. A literal move animation
   * would tween a card from its old cell to its new one — and on a board whose
   * columns are 300px wide and which scrolls horizontally, the two cells are
   * usually not on screen together, so most of that motion would play where
   * nobody is looking. What is actually observable is that something is now
   * here that was not, and that is what gets marked.
   *
   * Compared against the previous read rather than against a render: a filter,
   * a fold or a re-sort moves nothing between columns, and flashing on those
   * would turn a signal into decoration.
   */
  const placed = useRef(new Map<string, string>())
  const [arrived, setArrived] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!all.length) return

    const now = new Map(all.map((r) => [r.url, sectionOf(r)]))
    const seen = placed.current
    placed.current = now

    /* Nothing on the first read: every row would count as having arrived, and
       a board that flashes wholesale on open is noise, not news. */
    if (!seen.size) return

    const moved = new Set(
      [...now]
        .filter(([url, section]) => seen.has(url) && seen.get(url) !== section)
        .map(([url]) => url),
    )
    if (!moved.size) return

    setArrived(moved)
    const clear = setTimeout(() => setArrived(new Set()), 2000)
    return () => clearTimeout(clear)
  }, [all])

  /* Unfiltered totals, so a filtered board never narrows silently. */
  const totals = useMemo(() => {
    const map = new Map<string, number>()
    for (const r of all) map.set(sectionOf(r), (map.get(sectionOf(r)) ?? 0) + 1)
    return map
  }, [all])

  const shownTotals = useMemo(() => {
    const map = new Map<string, number>()
    for (const r of shown)
      map.set(sectionOf(r), (map.get(sectionOf(r)) ?? 0) + 1)
    return map
  }, [shown])

  /*
   * The active chip follows what is ON SCREEN, never what was last tapped. The
   * moment you swipe rather than tap, a last-tapped model is wrong and the rail
   * becomes a liar — worse than having no rail at all.
   */
  useEffect(() => {
    const root = scroller.current
    /*
     * A running picture of every column, not just the ones that moved.
     *
     * The callback receives ONLY the entries whose intersection changed, and
     * the old code took the best of that batch — so mid-swipe a column on its
     * way out at 0.45 could beat one arriving whose entry was not in the batch,
     * and the highlight flapped between two chips several times a second. Each
     * flip fired a smooth scroll on the rail, which restarted the previous one
     * from wherever it had got to. That is the vibration.
     *
     * Keeping the ratios in a map and choosing across all of them means the
     * answer only changes when the actual winner does.
     */
    const ratios = new Map<string, number>()

    /* Finer thresholds so the map is current rather than quantised into three
       steps, which was the other half of why a near-tie could flip. */
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const id = entry.target.getAttribute("data-column")
          if (id)
            ratios.set(id, entry.isIntersecting ? entry.intersectionRatio : 0)
        }

        let best: string | undefined
        let most = 0
        for (const [id, ratio] of ratios)
          if (ratio > most) {
            most = ratio
            best = id
          }

        if (best) setActive(best)
      },
      { root: root ?? null, threshold: [0, 0.25, 0.5, 0.75, 1] },
    )

    for (const el of anchors.current.values()) observer.observe(el)
    return () => observer.disconnect()
  }, [lanes])

  /*
   * The rail follows the grid.
   *
   * Without this it shows the destination but never the journey: you swipe two
   * columns across and the highlight simply teleports, or worse sits on a chip
   * that has scrolled out of the rail entirely. Keeping the active chip in view
   * is what makes the rail read as a position indicator rather than a menu.
   *
   * scrollLeft rather than scrollIntoView on the chip: the latter walks up to
   * every scrollable ancestor, so it would drag the page as well as the rail.
   */
  useEffect(() => {
    const strip = rail.current
    if (!strip || !active) return

    const chip = strip.querySelector<HTMLElement>(`[data-chip="${active}"]`)
    if (!chip) return

    const target = Math.max(
      0,
      chip.offsetLeft - (strip.clientWidth - chip.clientWidth) / 2,
    )

    /*
     * A deadzone, because "keep it in view" and "keep it centred" are different
     * promises and only the first one was wanted. Correcting by four pixels on
     * every observer tick is what a smooth scroll cannot survive: each call
     * restarts the animation, so a run of tiny corrections reads as a shudder
     * rather than as following.
     */
    if (Math.abs(strip.scrollLeft - target) < 24) return

    strip.scrollTo({
      left: target,
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
    })
  }, [active])

  /*
   * The panel lives in the URL, pushed as a history entry rather than a
   * navigation.
   *
   * That is what makes the browser's back gesture close it — the thing people
   * actually reach for, and the thing that feels broken if it navigates the
   * whole app away instead. It also makes a row shareable, which costs nothing
   * once the state is there.
   */
  useEffect(() => {
    const fromUrl = () =>
      setOpen(new URLSearchParams(location.search).get("row") ?? undefined)
    fromUrl()
    addEventListener("popstate", fromUrl)
    return () => removeEventListener("popstate", fromUrl)
  }, [])

  const openRow = useCallback((row: Row) => {
    const key = `${row.repo}#${row.number}`
    const url = new URL(location.href)
    url.searchParams.set("row", key)
    history.pushState(null, "", url)
    setOpen(key)
  }, [])

  const closeRow = useCallback(() => {
    /* Back rather than replaceState, so the entry pushed on open is consumed
       instead of accumulating a history of closes. */
    if (new URLSearchParams(location.search).get("row")) history.back()
    else setOpen(undefined)
  }, [])

  /*
   * Tapping a chip moves the board — and it did not, because the snap fought it.
   *
   * Under `scroll-snap-type: both mandatory` the browser re-snaps DURING a
   * smooth programmatic scroll, and the nearest snap point mid-animation is the
   * column you were already on. So a tap on a distant chip animated a little way
   * and came straight back, which reads as a dead button rather than as a fight.
   * Exactly the failure the scroll memory hit, in the other direction.
   *
   * Snapping comes off for the length of the move and back on when it lands.
   * `scrollend` is the honest signal for "it landed"; the timeout is for the
   * browsers that do not send it, and is longer than any scroll this can start.
   */
  const goTo = (id: string) => {
    const anchor = anchors.current.get(id)
    const strip = scroller.current
    if (!anchor || !strip) return

    const still = matchMedia("(prefers-reduced-motion: reduce)").matches
    const snap = strip.style.scrollSnapType
    strip.style.scrollSnapType = "none"

    const restore = () => {
      strip.style.scrollSnapType = snap
      strip.removeEventListener("scrollend", restore)
    }
    strip.addEventListener("scrollend", restore)
    setTimeout(restore, 1000)

    anchor.scrollIntoView({
      behavior: still ? "auto" : "smooth",
      inline: "start",
      block: "nearest",
    })
  }

  const openRowData = open
    ? all.find((r) => `${r.repo}#${r.number}` === open)
    : undefined

  /* A `?row=` link opens the panel at every width now, so there is no door to
     guard: the panel IS the answer to that link rather than a desk-only
     detour it had to be redirected around. */

  /* Only what has crossed into your side is worth interrupting anyone for. */
  const attention = useMemo(
    () => shown.filter((r) => r.move === "you"),
    [shown],
  )
  const { permission, ask } = useNotifier(attention, { enabled: notify, sound })

  const chooseNotify = useCallback(
    async (on: boolean) => {
      if (on && permission === "default") await ask()
      setNotify(on)
      try {
        localStorage.setItem("ym:notify", on ? "1" : "0")
      } catch {}
    },
    [ask, permission],
  )

  const chooseSound = useCallback((on: boolean) => {
    /* The tap that turns it on is the gesture that unlocks audio — a context
       created without one is suspended for the life of the page. */
    if (on) unlockChime()
    setSound(on)
    try {
      localStorage.setItem("ym:sound", on ? "1" : "0")
    } catch {}
  }, [])

  const yoursTotal = shown.filter((r) => r.move === "you").length
  const hidden = all.length - shown.length
  /*
   * How old the answer is, coarsely.
   *
   * This used to render through `Ago`, which keeps a one-second interval so a
   * card can count "40s". In a header that never changes otherwise, a number
   * moving every second reads as a stopwatch — as though the app were timing
   * something — when all it is saying is "this is current". Minutes are the
   * smallest unit worth a redraw here, and under a minute there is no number
   * worth showing at all.
   */
  const freshness = !inbox
    ? undefined
    : age < 60_000
      ? "just now"
      : age < 3_600_000
        ? `${Math.round(age / 60_000)}m ago`
        : `${Math.round(age / 3_600_000)}h ago`
  const rateLimited = (inbox?.reasons ?? []).some((r) => /rate limit/i.test(r))
  const allFailed = Boolean(
    inbox && inbox.failed.length > 0 && all.length === 0,
  )
  const healthy = liveness === "live" || liveness === "refreshing"

  return (
    <>
      <Sky />

      <WritableRepos repos={repos.map((r) => r.name)}>
        <main className="relative z-10 mx-auto flex h-safe max-w-[1600px] flex-col px-3 pb-3 pt-4 md:px-6 md:pb-6 md:pt-8">
          <header className="flex items-center gap-2 pb-3 md:flex-wrap md:items-end md:gap-x-4 md:pb-4">
            {/*
            The mark sits beside the whole left stack rather than inside the
            `h1`, because the `h1` is baseline-aligned and a picture has no
            baseline to sit on. Centred against both lines, it reads as the
            block's marker instead of as a very large piece of punctuation.
          */}
            <div className="flex min-w-0 flex-1 items-center gap-2 md:gap-2.5">
              <Mark className="h-auto w-6 shrink-0 md:w-[30px]" />

              <div className="min-w-0 flex-1">
                <h1 className="flex items-baseline gap-2 font-serif text-[19px] font-semibold leading-tight tracking-[-0.015em] md:text-[27px]">
                  Your Move
                  {/* Wide only: a baseline orients someone meeting the app for the
                  first time, and on his own phone he is never that reader. It
                  sits ON the title baseline rather than under it, so where it
                  does show it costs no vertical space. */}
                  <span className="hidden truncate font-sans text-[13px] font-normal tracking-normal text-fg-quiet md:inline">
                    GitHub moves. Your turn.
                  </span>
                </h1>
                {/* Under the name rather than instead of it: it answers "what's on my
                board" better than a title that says less. A degraded state gets
                MORE space, not less. */}
                <button
                  type="button"
                  onClick={() => void refresh()}
                  aria-label="Refresh"
                  className="flex max-w-full mt-1 items-center gap-1.5 truncate text-left text-[12px] text-fg-quiet md:font-mono md:text-[9.5px] md:uppercase md:tracking-[0.16em]"
                >
                  <span aria-hidden>
                    {liveness === "live"
                      ? "●"
                      : liveness === "refreshing"
                        ? "◐"
                        : "◌"}
                  </span>
                  {healthy ? null : (
                    <span className="text-brass">
                      {LIVENESS_TEXT[liveness]} ·
                    </span>
                  )}
                  {yoursTotal > 0 ? (
                    <>
                      <b className="font-semibold text-accent">{yoursTotal}</b>
                      <span>need{yoursTotal === 1 ? "s" : ""} you</span>
                    </>
                  ) : (
                    <span>nothing needs you</span>
                  )}
                  {lanes.length ? (
                    <>
                      <span aria-hidden>·</span>
                      <span className="font-mono tabular-nums">
                        {lanes.length}{" "}
                        {lanes.length === 1 ? "project" : "projects"}
                      </span>
                    </>
                  ) : null}
                  {freshness ? (
                    <>
                      <span aria-hidden>·</span>
                      <span>{freshness}</span>
                    </>
                  ) : null}
                  {inbox?.budget ? (
                    <span
                      className="hidden font-mono tabular-nums md:inline"
                      title="GitHub GraphQL points left this hour"
                    >
                      · {inbox.budget.remaining}
                    </span>
                  ) : null}
                </button>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-1.5 md:ml-auto md:gap-2">
              <Filters
                repos={repos}
                status={status}
                labels={labels}
                picks={picks}
                onChange={setPicks}
                views={views}
                onViews={changeViews}
              />
              <Menu
                login={inbox?.login}
                doneDays={doneDays}
                onDoneDays={(d) => {
                  setDoneDays(d)
                  void refresh()
                }}
                notify={notify}
                onNotify={(on) => void chooseNotify(on)}
                sound={sound}
                onSound={chooseSound}
                permission={permission}
                openMode={openMode}
                onOpenMode={chooseOpenMode}
                views={views}
                onViews={changeViews}
                order={order}
                onOrder={chooseOrder}
              />
            </div>
          </header>

          {liveness === "expired" ? (
            <p className="mb-2 rounded-lg border border-brass p-3 text-[13px]">
              <span aria-hidden>! </span>
              Your GitHub session has expired.{" "}
              <a className="underline" href="/api/auth/login">
                Sign in again
              </a>
              .
            </p>
          ) : null}

          {inbox?.failed.length && !allFailed ? (
            <div className="mb-2 rounded-lg border border-brass p-2.5 text-[12px]">
              <p className="text-brass">
                <span aria-hidden>! </span>
                <strong>A source failed.</strong> An empty column below is
                missing data, not an empty status.
              </p>
              <details className="mt-1">
                <summary className="cursor-pointer text-fg-quiet">
                  {inbox.failed.length} sections affected
                </summary>
                <p className="mt-1 text-fg-quiet">{inbox.failed.join(", ")}</p>
                {inbox.reasons?.length ? (
                  <p className="mt-1 font-mono text-fg-quiet">
                    {inbox.reasons.join(" · ")}
                  </p>
                ) : null}
              </details>
            </div>
          ) : null}

          {filtering ? (
            /* Takes layout rather than being a toast: the board must visibly be a
             smaller thing than the app, or a filtered board lies exactly the way
             a broken one does. */
            <div className="mb-2 flex flex-wrap items-center gap-2 rounded-lg border border-accent/50 bg-accent-dim px-2.5 py-1.5 text-[12.5px]">
              <span className="min-w-0 truncate">
                Filtered to{" "}
                {[
                  ...picks.move.map((m) =>
                    m === "you" ? "your move" : "their move",
                  ),
                  ...picks.repos.map(shortName),
                  ...picks.status,
                  ...picks.labels,
                ].join(", ")}
                {hidden > 0 ? ` · ${hidden} hidden` : ""}
              </span>
              <button
                type="button"
                onClick={() =>
                  setPicks({ repos: [], status: [], labels: [], move: [] })
                }
                className="ml-auto shrink-0 text-accent hover:underline"
              >
                Clear
              </button>
            </div>
          ) : null}

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-line bg-panel shadow-panel shadow-[0_1px_0_rgba(255,255,255,.04)_inset,0_30px_80px_-40px_rgba(0,0,0,.9)]">
            {allFailed ? (
              /* One block, one fact, one way out. Redundancy reads as panic. */
              <div className="flex flex-col items-start gap-3 p-5">
                <p className="text-[15px] font-semibold text-brass">
                  <span aria-hidden>! </span>
                  {rateLimited
                    ? "GitHub's hourly budget is spent."
                    : "GitHub did not answer."}
                </p>
                <p className="max-w-[52ch] text-[13.5px] leading-[1.5] text-fg-mute">
                  {rateLimited ? (
                    <>
                      This board is empty because nothing could be read, not
                      because nothing is waiting. The budget refills on its own
                      {inbox?.budget?.resetAt ? (
                        <>
                          {" "}
                          at{" "}
                          {new Date(inbox.budget.resetAt).toLocaleTimeString(
                            [],
                            {
                              hour: "2-digit",
                              minute: "2-digit",
                            },
                          )}
                        </>
                      ) : (
                        " within the hour"
                      )}
                      .
                    </>
                  ) : (
                    "This board is empty because nothing could be read, not because nothing is waiting."
                  )}
                </p>
                <button
                  type="button"
                  onClick={() => void refresh()}
                  className="rounded-lg border border-line px-2.5 py-1 text-[13px] text-fg-mute hover:text-fg"
                >
                  Try again
                </button>
              </div>
            ) : !inbox ? (
              <div className="flex flex-col gap-2 p-3">
                <div className="shimmer h-[76px] rounded-[9px] bg-panel-2" />
                <div className="shimmer h-[76px] rounded-[9px] bg-panel-2" />
                <div className="shimmer h-[76px] rounded-[9px] bg-panel-2" />
              </div>
            ) : lanes.length === 0 ? (
              /* The restful empty board. The section vocabulary survives here — it
               says what the board watches, without a grid of empty boxes. */
              <div className="flex flex-col items-start gap-3 p-6">
                <p className="text-[15px] text-fg">
                  {filtering
                    ? "Nothing matches this filter."
                    : "Nothing is waiting on you."}
                </p>
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-[12.5px] text-fg-quiet">
                  {COLUMNS.filter((s) => s !== DONE).map((s) => {
                    const p = presentationFor(s)
                    return (
                      <span key={s} className="flex items-center gap-1.5">
                        <SectionMark id={s} className="size-3 shrink-0" />
                        {p.title}
                      </span>
                    )
                  })}
                </div>
              </div>
            ) : (
              <>
                {/*
                 * The rail changes job by width, and above `md` it disappears:
                 * the grid's own sticky column headers ARE the section rail, and
                 * showing both would be the same information twice.
                 *
                 * On narrow it addresses the axis the stack keeps — projects.
                 */}
                {/* The rail navigates the horizontal axis, which is the one a
                  narrow screen cannot show all of at once. */}
                <nav
                  ref={rail}
                  className="no-scrollbar flex gap-1.5 overflow-x-auto overscroll-x-contain border-b border-line-soft bg-panel px-2.5 py-1.5 md:hidden"
                >
                  {COLUMNS.map((id) => {
                    const p = presentationFor(id)
                    const now = shownTotals.get(id) ?? 0
                    return (
                      <button
                        key={id}
                        type="button"
                        data-chip={id}
                        onClick={() => goTo(id)}
                        aria-label={p.title}
                        className={`flex shrink-0 items-center gap-1.5 rounded-lg border px-2 py-0.5 text-[12.5px] transition-colors ${
                          active === id
                            ? "border-accent bg-accent-dim text-fg"
                            : "border-line text-fg-mute"
                        }`}
                      >
                        <SectionMark id={id} className="size-3 shrink-0" />
                        <span>{p.title}</span>
                        <span className="font-mono tabular-nums text-fg-quiet">
                          {now}
                        </span>
                      </button>
                    )
                  })}
                </nav>

                <div className="min-h-0 flex-1">
                  <Swimlanes
                    lanes={lanes}
                    columns={COLUMNS}
                    counts={shownTotals}
                    onChanged={applyLabel}
                    onOpen={openRow}
                    register={register}
                    scroller={scroller}
                    folded={folded}
                    onFold={fold}
                    arrived={arrived}
                    inApp={openMode !== "github"}
                  />
                </div>
              </>
            )}
          </div>

          {/*
          Desktop only, and that is the right asymmetry rather than an omission:
          on a phone this content lives in the menu, where someone wondering
          where the data comes from actually goes looking. Here there is room
          for it on the page, so it sits on the page.
        */}
          <footer className="mt-3 hidden shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-t border-line pt-2 text-[12px] text-fg-quiet md:flex">
            <span>
              Read live from GitHub, cached for five minutes. Nothing is stored;
              labels are the only thing written back.
            </span>

            {[
              { label: "Source", href: "https://github.com/kud/your-move" },
              {
                label: "Report an issue",
                href: "https://github.com/kud/your-move/issues/new",
              },
              { label: "@kud", href: "https://github.com/kud" },
            ].map((out) => (
              <a
                key={out.label}
                href={out.href}
                target="_blank"
                rel="noreferrer"
                className="underline decoration-line underline-offset-2 hover:text-fg hover:decoration-accent"
              >
                {out.label}
              </a>
            ))}

            {/* No private repo names here: this page is public, and the origin
              is worth telling without naming what it came out of. */}
            <span className="ml-auto text-right">
              Built to answer one question across a lot of repositories — whose
              move is it — then made general.
            </span>
          </footer>
          {/* Every width. The reasoning, and why the earlier desk-only call was
            answering the wrong question, is at the top of `detail.tsx`. */}
          {openRowData && openMode !== "github" ? (
            <Detail
              row={openRowData}
              onClose={closeRow}
              onLabelChange={applyLabel}
              mode={openMode}
              onMode={chooseOpenMode}
            />
          ) : null}
        </main>
      </WritableRepos>
    </>
  )
}
