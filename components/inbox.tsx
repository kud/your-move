"use client"

import { tip } from "@/components/tooltip"
import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react"

import {
  BOARD_W,
  BoardSkeleton,
  COLUMNS,
  DONE,
  FRAME,
  reasonFor,
  sectionOf,
  Swimlanes,
  type Lane,
} from "@/components/board"
import { Detail, type OpenMode } from "@/components/detail"
import { Mark, MarkMono } from "@/components/mark"
import { Launcher, LAUNCHER_ID, type Command } from "@/components/launcher"
import { Menu } from "@/components/menu"
import {
  FILTERS_ID,
  Filters,
  Glyph,
  countPicks,
  labelCounts,
  repoCounts,
  statusCounts,
  summarise,
  type Picks,
} from "@/components/filters"
import { SectionMark } from "@/components/section-mark"
import { Sky } from "@/components/sky"
import { useNotifier } from "@/components/use-notifier"
import { WritableRepos } from "@/components/use-writable"
import { useScrollMemory } from "@/components/use-scroll-memory"
import { unlockChime } from "@/lib/chime"
import { useInbox, type Liveness } from "@/components/use-inbox"
import { byCellOrder, byLaneOrder, shortName } from "@/lib/order"
import {
  presentationFor,
  shortfalls,
  sourceTitle,
  truncations,
} from "@/lib/sections"
import {
  decodeShare,
  emptyPicks,
  readViews,
  samePicks,
  writeViews,
  type View,
} from "@/lib/views"
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

export const Inbox = ({
  initial,
  picks: initialPicks,
  offline = false,
}: {
  initial?: InboxData
  picks?: Picks
  /* Set only by `/offline`, which hands in a board read back from this device
     and needs every path to GitHub to leave rather than fail. See `useInbox`. */
  offline?: boolean
}) => {
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
    offline,
  )
  /*
   * The server already read the URL — see `app/page.tsx` — so this starts
   * filtered rather than starting empty and being corrected on mount.
   *
   * That correction was the second half of the boot jump: the chip row was
   * absent from the board's own server HTML too, so it appeared at hydration
   * and pushed every lane down a second time, just after the shell had finished
   * pushing them down the first time. An initialiser cannot reflow.
   *
   * The prop is optional so that a board mounted without a server pass — a test,
   * a story — still gets empty picks rather than `undefined`.
   */
  const [picks, setPicks] = useState<Picks>(() => initialPicks ?? emptyPicks())
  const [active, setActive] = useState<string>()
  const [folded, setFolded] = useState<Set<string>>(new Set())
  /* Pinned PROJECTS, the promoting twin of `folded`. Folding compresses what
     you do not care about; a pin lifts what you do, which is the same want
     approached from the other end and the only one of the two that works on a
     day the project is quiet. Same per-device rationale, same shape, own key. */
  const [pinned, setPinned] = useState<Set<string>>(new Set())
  /* Folded COLUMNS, the horizontal twin of `folded`. Same per-device rationale
     as the comment below, same shape, its own key. */
  const [cols, setCols] = useState<Set<string>>(new Set())

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
      const savedCols = localStorage.getItem("ym:cols")
      if (savedCols) setCols(new Set(JSON.parse(savedCols) as string[]))
      const savedPins = localStorage.getItem("ym:pinned")
      if (savedPins) setPinned(new Set(JSON.parse(savedPins) as string[]))
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

  /*
   * A pin is a name, and a name is all it is — deliberately the weak form.
   *
   * `lib/views.ts` sets out why enumerating repository names is the wrong shape
   * for a FILTER: the set is a copy of your repository list as of the moment you
   * ticked it, and "it goes wrong by omission the moment a repository is added —
   * silently". Read that comment before reopening this. It condemns the shape
   * there and acquits it here, because for a pin the identical omission is the
   * correct behaviour: a repository you have just acquired is simply not pinned
   * yet. `ym:folded` has relied on exactly this since it shipped.
   *
   * Unbounded on purpose. A cap would only earn itself if "pinned" stopped
   * meaning anything past five or six, and nothing here can know that number.
   */
  const pin = useCallback((repo: string) => {
    setPinned((was) => {
      const next = new Set(was)
      if (next.has(repo)) next.delete(repo)
      else next.add(repo)
      try {
        localStorage.setItem("ym:pinned", JSON.stringify([...next]))
      } catch {}
      return next
    })
  }, [])

  /*
   * Folding changes no count anywhere — not `hidden`, not the lane totals, not
   * the header counts. Filtering REMOVES rows; folding compresses a region that
   * is still fully on the board. The moment a fold touched a count the board
   * would start lying in exactly the way the filter banner exists to prevent,
   * which is also why this needs no banner and no badge on the filter button.
   */
  const foldCol = useCallback((id: string) => {
    setCols((was) => {
      const next = new Set(was)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      try {
        localStorage.setItem("ym:cols", JSON.stringify([...next]))
      } catch {}
      return next
    })
  }, [])

  /* Written back to the URL, so a filtered board is shareable and can be
     installed to a home screen as its own view — one per facet, so a link says
     which dimension it narrowed. Reading it back is the server's job now, and
     deliberately not also a job here: two readers is how the board came to
     disagree with its own shell. */
  useEffect(() => {
    const url = new URL(location.href)
    for (const key of [
      "repos",
      "owners",
      "status",
      "labels",
      "move",
    ] as const) {
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
   * Four commands, every one conditional — which is the answer to "a palette
   * over this app would be present and mostly empty". With no saved views and
   * no filter on, the Actions group does not exist and the launcher is purely a
   * jump-to. It grows with the state it acts on.
   *
   * The view copy is lifted verbatim from the filter sheet's own titles: the
   * app should not hold two phrasings for one act.
   */
  const commands = useMemo((): Command[] => {
    const list: Command[] = []
    for (const view of views) {
      const on = samePicks(view.picks, picks)
      list.push({
        id: `view:${view.name}`,
        label: on ? `Turn off "${view.name}"` : `Apply "${view.name}"`,
        run: () => setPicks(on ? emptyPicks() : view.picks),
      })
    }
    if (filtering)
      list.push({
        id: "clear",
        label: "Clear all filters",
        run: () => setPicks(emptyPicks()),
      })
    list.push({
      id: "refresh",
      label: "Refresh the board",
      run: () => void refresh(),
    })
    if (cols.size)
      list.push({
        id: "unfold",
        label: "Unfold every column",
        run: () => {
          setCols(new Set())
          try {
            localStorage.setItem("ym:cols", "[]")
          } catch {}
        },
      })
    return list
  }, [views, picks, filtering, refresh, cols])

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
              /* Owners and repos are ONE dimension, so they OR. Owner `kud`
                 AND repo `acme/x` yielding nothing is never what anyone
                 means by ticking both. */
              ((!picks.repos.length && !picks.owners.length) ||
                picks.repos.includes(r.repo) ||
                picks.owners.includes(r.repo.split("/")[0] ?? "")) &&
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
          /* Yours first, drafts last within their band, then heat, then
           recency. The rule and the reasoning behind the middle keys live in
           `lib/order.ts`. The comparator is parameterised by the cell's own
           column and by the moment of the read, because the heat key is: a
           cell is one lane in one column, so both are constant here. */
          for (const [key, rs] of cells)
            cells.set(key, [...rs].sort(byCellOrder(key, inbox?.fetchedAt)))

          return {
            repo,
            cells,
            total: rows.length,
            yours: rows.filter((r) => r.move === "you").length,
          }
        })
        /* Pins first, then urgency or name. The rule and the reasoning behind
           all three keys live in `lib/order.ts`. */
        .sort(byLaneOrder(order, pinned))
    )
  }, [shown, order, pinned, inbox?.fetchedAt])

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
        ? `${Math.round(age / 60_000)} min ago`
        : `${Math.round(age / 3_600_000)} hr ago`
  const rateLimited = (inbox?.reasons ?? []).some((r) => /rate limit/i.test(r))
  const allFailed = Boolean(
    inbox && inbox.failed.length > 0 && all.length === 0,
  )
  const sampled = truncations(inbox?.coverage)
  /* A source that answered short joins the FAILURE notice, not the coverage
     one: failed and short are the same kind of event differing in degree, where
     a cap is categorically different — nothing went wrong in a capped column.
     It also keeps that region at three notices, which is where it stops reading
     as a column of facts and starts being a stack. */
  const short = shortfalls(inbox?.coverage)
  const healthy = liveness === "live" || liveness === "refreshing"

  return (
    <>
      <Sky />

      <WritableRepos repos={repos.map((r) => r.name)} offline={offline}>
        <main
          style={{ "--ym-frame": `${BOARD_W}px` } as CSSProperties}
          className={FRAME}
        >
          <header className="flex items-center gap-2 pb-3 md:flex-wrap md:items-end md:gap-x-4 md:pb-4">
            {/*
            The mark sits beside the whole left stack rather than inside the
            `h1`, because the `h1` is baseline-aligned and a picture has no
            baseline to sit on. Centred against both lines, it reads as the
            block's marker instead of as a very large piece of punctuation.
          */}
            <div className="flex min-w-0 flex-1 items-center gap-2 md:gap-2.5">
              {/* `ym-hop` is a one-shot reaction, not a hover state — the
                  argument for that, and for the literal 420ms, is beside the
                  keyframes in `app/globals.css`. */}
              <Mark className="ym-hop h-auto w-6 shrink-0 md:w-[30px]" />

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
                  {...tip("Refresh")}
                  /*
                    This has always been the refresh — the glyph in front of it
                    is already its state — but nothing said so: no cursor, no
                    hover, no tooltip, so it read as a caption. A second refresh
                    control would have been the wrong fix for that; the line
                    just had to admit what it is.
                  */
                  /*
                    Wraps rather than truncates, and each fact is one
                    unsplittable span carrying its own leading separator.

                    `truncate` was both halves of a bug here. It is
                    `overflow:hidden` + `ellipsis` + `nowrap`, and on a FLEX
                    container the ellipsis does not apply to the item children —
                    while the `nowrap` is inherited by every one of them, so each
                    segment's min-content is its full text and none can shrink.
                    The line went rigid and ran past its box, clipping the
                    freshness mid-word on a phone: the one segment `CLAUDE.md`
                    says must survive, since saying how old the answer is is what
                    separates this from a mirror.

                    Wrapping is unconditional on purpose. Healthy content fits on
                    one row and never triggers it; a degraded state prefixes up
                    to eighteen characters and takes a second row, which is the
                    "a degraded state gets MORE space, not less" rule above being
                    honoured by the layout rather than only asserted. The height
                    change is itself the signal.

                    The separator binds to the FRONT of the segment it
                    introduces, so a wrapped row opens `· just now` — a
                    continuation — never an orphaned dot. The count and its noun
                    are one phrase set with a literal space, not a 6px flex gap.
                  */
                  className="mt-1 flex max-w-full cursor-pointer flex-wrap items-center gap-x-1.5 gap-y-0.5 text-left text-[12px] text-fg-quiet transition-colors hover:text-fg-mute md:font-mono md:text-[9.5px] md:uppercase md:tracking-[0.16em]"
                >
                  <span className="shrink-0" aria-hidden>
                    {liveness === "live"
                      ? "●"
                      : liveness === "refreshing"
                        ? "◐"
                        : "◌"}
                  </span>
                  {healthy ? null : (
                    <span className="whitespace-nowrap text-brass">
                      {LIVENESS_TEXT[liveness]} ·
                    </span>
                  )}
                  {yoursTotal > 0 ? (
                    <span className="whitespace-nowrap">
                      <b className="font-semibold text-accent">{yoursTotal}</b>{" "}
                      need{yoursTotal === 1 ? "s" : ""} you
                    </span>
                  ) : (
                    <span className="whitespace-nowrap">nothing needs you</span>
                  )}
                  {/* Wide only: the lanes below already enumerate every project
                      with its own `N you` pill and item count, so on the phone
                      this summarises a list the page is already showing. It is
                      the only segment with a second home, which is why it is the
                      one that goes. */}
                  {lanes.length ? (
                    <span className="hidden whitespace-nowrap font-mono tabular-nums md:inline">
                      <span aria-hidden>·</span> {lanes.length}{" "}
                      {lanes.length === 1 ? "project" : "projects"}
                    </span>
                  ) : null}
                  {freshness ? (
                    <span className="whitespace-nowrap">
                      <span aria-hidden>·</span> {freshness}
                    </span>
                  ) : null}
                  {inbox?.budget ? (
                    <span
                      className="hidden whitespace-nowrap font-mono tabular-nums md:inline"
                      title="GitHub GraphQL points left this hour"
                    >
                      <span aria-hidden>·</span> {inbox.budget.remaining}
                    </span>
                  ) : null}
                </button>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-1.5 md:ml-auto md:gap-2">
              {/* A shortcut with no visible control is invisible to anyone who
                  did not read a changelog — and ⌘K does not exist on a phone at
                  all, which is the surface this board is mostly read on. */}
              <button
                type="button"
                popoverTarget={LAUNCHER_ID}
                aria-label="Find anything on the board"
                {...tip("Find anything  ⌘K")}
                className="grid size-8 shrink-0 place-items-center rounded-full border border-line text-fg-mute transition-colors hover:border-accent hover:text-fg"
              >
                <svg
                  viewBox="0 0 16 16"
                  aria-hidden
                  className="size-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                >
                  <circle cx="7" cy="7" r="4.25" />
                  <path d="M10.2 10.2 L13.5 13.5" />
                </svg>
              </button>
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

          <Launcher rows={all} commands={commands} onOpen={openRow} />

          {/*
            In the frame, not in the header.

            The header already carries `◌ Offline ·` and it is not enough, for a
            reason particular to that line: it sits beside the age, and an age
            beside a title reads as "recently refreshed" at a glance — the exact
            opposite of what this has to say. A stale board is only better than
            no board while the label cannot be missed, so the label takes
            layout, pushes the board down, and stays there.

            Glyph, word and age together, and none of the three is doing the
            work alone. It carries no action of its own: the header's own
            refresh is already the way back, and offline it navigates home
            rather than refetching.

            `◌` is the SAME glyph the liveness dot in the header is showing at
            this moment, and that is the point rather than a coincidence. This
            comment used to claim as much while drawing `○` — one glyph apart,
            which is the distance at which two marks read as two different
            states. The header and the banner are one fact reported twice, so
            they show one mark; what separates offline from merely stale is the
            WORD, in both places, which is the rule the whole board runs on.
          */}
          {liveness === "offline" && inbox ? (
            <p className="mb-2 rounded-lg border border-brass p-3 text-[13px]">
              <span aria-hidden>◌ </span>
              <strong>Offline.</strong> This is the last board this device saw,{" "}
              {freshness}. Nothing on it will change until you are back.
            </p>
          ) : null}

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

          {/*
            Two leads, one box. A source that failed and a source that answered
            short are the same event at different degrees — rows are missing and
            nothing you did caused it — so they share a tone and a disclosure.
            Failed first, worst-first, exactly as the stack itself is ordered.

            The lists stay LABELLED apart inside the disclosure. `{n} sections
            affected` is a correct summary of the union, but an unlabelled list
            beneath it would claim both halves are the same kind, which is the
            distinction this whole notice exists to draw.
          */}
          {(inbox?.failed.length || short.length) && !allFailed ? (
            <div className="mb-2 rounded-lg border border-brass p-2.5 text-[12px]">
              {inbox?.failed.length ? (
                <p className="text-brass">
                  <span aria-hidden>! </span>
                  <strong>A source failed.</strong> An empty column below is
                  missing data, not an empty status.
                </p>
              ) : null}
              {short.length ? (
                <p
                  className={`text-brass${inbox?.failed.length ? " mt-1" : ""}`}
                >
                  <span aria-hidden>! </span>
                  <strong>A source answered short.</strong> Rows are missing
                  from a column below — not filtered out, and not gone.
                </p>
              ) : null}
              <details className="mt-1">
                <summary className="cursor-pointer text-fg-quiet">
                  {(inbox?.failed.length ?? 0) + short.length} sections affected
                </summary>
                {inbox?.failed.length ? (
                  <p className="mt-1 text-fg-quiet">
                    Failed: {inbox.failed.map(sourceTitle).join(", ")}
                  </p>
                ) : null}
                {short.length ? (
                  <p className="mt-1 text-fg-quiet">
                    Short: {short.map(sourceTitle).join(", ")}
                  </p>
                ) : null}
                {inbox?.reasons?.length ? (
                  <p className="mt-1 font-mono text-fg-quiet">
                    {inbox.reasons.join(" · ")}
                  </p>
                ) : null}
              </details>
            </div>
          ) : null}

          {/*
            A column showing a subset says so, or it is lying by arithmetic.

            Not a failure, which is why it is not the brass notice above: every
            source answered, and each answered completely for the window it was
            allowed. What it cannot say on its own is that the window is smaller
            than the world — `reviewRequests` asks GitHub for 20, and on this
            account far more match, so a column headed `20` was reporting its own
            cap and reading as a total. The board's whole posture is that a
            partial answer is fine and an answer pretending to be whole is not.

            THE RATIO IS GONE, AND IT CANNOT COME BACK. This read "showing 20 of
            99" until 2026-09-09, and the 99 was GitHub's `issueCount` — an
            estimate observed wrong in both directions, including SMALLER than
            the rows drawn from it. So the line states a floor now, "showing the
            first 20", which is ours and exact; the estimate is named as
            GitHub's and only appears when it exceeds what we showed. That guard
            is load-bearing rather than tidy: without it this prints "showing the
            first 16 · GitHub estimates 8".

            It fires on `capped` — we asked for N and got N — which is why the
            caveat below is now precisely true of the event that triggered it.
            The old condition was `matched > returned`, which fired on sources
            nowhere near their cap and explained them with a sentence about caps.
            A true sentence about a false situation is the hardest kind of wrong
            to read, and it was read as incomprehensible rather than as wrong.

            It also governs what a DIFF may claim. `use-notifier` marks arrivals
            by comparing one fetch with the next; on a truncated source a row
            leaving the WINDOW is not a row leaving the WORLD, so presence
            changes there carry no news. Nothing reads this yet — the notice is
            the honest floor, not the fix.

            Tone, glyph and placement were left plain on purpose, for the design
            decision to be taken rather than inherited from whoever plumbed the
            number. Settled now, and each of the four is a rule this board
            already holds elsewhere:

            THE LEAD SENTENCE SAYS THE CONSEQUENCE, NOT THE MECHANISM. It read
            "GitHub matched more than this board asked for, so a count below is
            what came back, not what exists", which is true and makes the reader
            derive what it means for them. What they need is the thing they were
            about to get wrong: a column's count is not its total. This board is
            read at a glance to answer one question, so a notice that needs
            parsing costs more than the truncation it reports.

            "SAMPLE" IS GONE, and it was wrong as well as clumsy. A sample
            claims to be representative; these are the rows one capped request
            came back with, which is a different and weaker claim. "Capped" is
            what actually happened and promises nothing it cannot keep.

            NO GLYPH. `○` here would be a THIRD ring meaning — after `◌` for not
            current and the header's liveness dot — and the two are near
            indistinguishable at 12px, which is colour-only differentiation
            wearing a shape's clothes. That is the rule this file breaks nowhere
            else. The box, the tone step and the words already separate this
            from the brass failure notice above it, so the ring was carrying no
            load. Same answer as the offline banner: let the words do it.

            THE NUMBERS ARE THE BRIGHT HALF. The caveat was bold over a quiet
            list, which is emphasis pointing at the wrong thing — you have come
            for the count, not for the sentence explaining why it is there. So
            the caveat sits in `fg-quiet` and the counts in `fg-mute` above it.
            The emphasis now splits WITHIN the line as well: the exact figure is
            the bright half and the estimate beside it is quiet, because one of
            them is a fact and the other is somebody else's guess.

            The disclosure went with it. It hid one line behind a triangle and
            said nearly the same thing twice — a rows-not-shown count, then the
            line it was derived from — so it split one fact across a click. Flat is
            shorter than the affordance that concealed it. If this ever lists
            enough sources to want folding again, that is the moment to argue
            for it, not now.

            PLACEMENT STANDS, and it is worth saying so rather than leaving it
            unexamined. It sits under the failed-source notice and above the
            filter banner, which reads worst-first: a source missing entirely,
            then a source partly missing, then a set you narrowed yourself. That
            is general to specific and severe to mild at once. A fourth notice
            in this region would be the point at which the stack needs a rethink
            — three is where it still reads as a column of facts about what you
            are looking at.
          */}
          {sampled.length ? (
            <div className="mb-2 rounded-lg border border-line bg-panel-2 p-2.5 text-[12px]">
              <ul className="text-fg-mute">
                {sampled.map((t) => (
                  <li key={t.source}>
                    {t.title} — showing the first {t.shown}
                    {t.estimate > t.shown ? (
                      <span className="text-fg-quiet">
                        {" · "}GitHub estimates {t.estimate}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
              <p className="mt-1 text-fg-quiet">
                A column&rsquo;s count is capped, not its total.
              </p>
            </div>
          ) : null}

          {filtering ? (
            /* Takes layout rather than being a toast: the board must visibly be a
             smaller thing than the app, or a filtered board lies exactly the way
             a broken one does. */
            /*
              Sized to its content, not to the frame.
            
              It still TAKES LAYOUT — it is in flow and pushes the board down,
              which is the part that matters: the board must visibly be a
              smaller thing than the app, or a filtered board lies the way a
              broken one does. Full-bleed was never what bought that. Once the
              frame went from 1600 to 2250 it became a mostly-empty band with
              `Clear` stranded a screen away from the sentence it acts on.
            */
            <div className="mb-2 flex w-fit max-w-full flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-accent/50 bg-accent-dim px-2.5 py-1.5 text-[12.5px] text-fg-mute">
              <span className="shrink-0">Filtered to</span>

              {summarise(picks, shortName).map((part, i) => (
                <Fragment key={part.key}>
                  {i > 0 ? (
                    <span aria-hidden className="shrink-0 text-fg-quiet">
                      ·
                    </span>
                  ) : null}
                  {/* Each segment opens the sheet rather than expanding here: a
                      disclosure would be a second place showing the same set,
                      and a banner you can expand into fifteen names is a banner
                      that can become the thing it was shrunk to avoid. The
                      sheet is where you would go to CHANGE it anyway. */}
                  <button
                    type="button"
                    popoverTarget={FILTERS_ID}
                    {...tip(part.full || undefined)}
                    className="flex shrink-0 items-center gap-1.5 rounded text-fg hover:underline"
                  >
                    {part.kind ? (
                      <span aria-hidden className="text-fg-quiet">
                        <Glyph tab={part.kind} />
                      </span>
                    ) : null}
                    {part.text}
                  </button>
                </Fragment>
              ))}

              {hidden > 0 ? (
                <>
                  <span aria-hidden className="shrink-0 text-fg-quiet">
                    ·
                  </span>
                  {/* The one number the banner exists to report, so it is the
                      one thing here that is not quiet. Weight and monospace,
                      never hue — accent means one thing on this board. */}
                  <span className="shrink-0 font-mono tabular-nums text-fg">
                    {hidden} hidden
                  </span>
                </>
              ) : null}
              <button
                type="button"
                onClick={() => setPicks(emptyPicks())}
                /* A rule rather than `ml-auto`: with the banner at content
                   width there is no free space to push into, and the divider
                   is what keeps an ACTION from reading as one more segment. */
                className="ml-1 shrink-0 border-l border-accent/30 pl-2.5 text-accent hover:underline"
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
              <BoardSkeleton />
            ) : lanes.length === 0 ? (
              /*
               * Two empty boards, and they are not the same news.
               *
               * A CLEAR board is the nicest moment the app has, and it gets the
               * one flourish in here: the mark at rest, the sentence in the
               * serif the wordmark already uses, and room around both. The
               * section vocabulary survives beside it — it says what the board
               * watches, without a grid of empty boxes.
               *
               * A FILTERED board that shows nothing is not good news at all. It
               * is a narrow view you built, and possibly narrowed too far.
               * Congratulating you for hiding things is the precise failure the
               * filter banner exists to prevent, so it gets no mark, no serif
               * and no centring — and no section list either, since those seven
               * are not "all clear", they are excluded by a filter you set.
               */
              filtering ? (
                <div className="flex flex-col items-start gap-3 p-6">
                  <p className="text-[15px] text-fg">
                    Nothing matches this filter.
                  </p>
                </div>
              ) : (
                <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
                  <MarkMono className="ym-in-fade h-auto w-[52px] text-fg-quiet md:w-[64px]" />
                  {/* The app's personality is its writing, and this is the one
                      sentence it most deserves to say properly. Never a loop:
                      a looping animation on a resting state says something is
                      happening on the one screen whose whole message is that
                      nothing is. */}
                  <p className="ym-in-fade font-serif text-[22px] font-semibold leading-tight tracking-[-0.015em] text-fg md:text-[26px]">
                    Nothing is waiting on you.
                  </p>
                  <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 text-[12.5px] text-fg-quiet">
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
              )
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
                    pinned={pinned}
                    onPin={pin}
                    cols={cols}
                    onFoldCol={foldCol}
                    arrived={arrived}
                    inApp={openMode !== "github"}
                    viewer={inbox?.login}
                    now={inbox?.fetchedAt}
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
