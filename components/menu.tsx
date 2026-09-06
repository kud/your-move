"use client"

import { useEffect, useRef, useState } from "react"

import type { OpenMode } from "@/components/detail"
import { exportViews, importViews, type View } from "@/lib/views"

/*
 * Everything that is about you rather than about the board.
 *
 * Identity, links out, the two settings that earn their place, and the
 * provenance line — which is the footer cut from narrow for density, arriving
 * at its proper home: the place someone actually looks when they wonder where
 * the data comes from.
 */

const ID = "ym-menu"

/* Raises the quiet tones and turns the sky off. Kept as an attribute on the
   root so the whole token set can answer at once, rather than every component
   learning about a preference. */
const CONTRAST = "ym:contrast"
const THEME = "ym:theme"
const MOTION = "ym:motion"

type Theme = "auto" | "light" | "dark"

/*
 * The status bar has to follow the theme, or the "native" illusion breaks at
 * exactly the seam it was hardest to fix: an OS bar painted near-black above a
 * light page. `theme-color` is a meta rather than a stylesheet value, so it is
 * the one token that has to be set imperatively.
 */
const GROUND: Record<"light" | "dark", string> = {
  dark: "#0b0c0e",
  light: "#f4f2f0",
}

const paintChrome = (theme: Theme) => {
  const resolved: "light" | "dark" =
    theme === "auto"
      ? matchMedia("(prefers-color-scheme: light)").matches
        ? "light"
        : "dark"
      : theme
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", GROUND[resolved])
  document.documentElement.style.background = GROUND[resolved]
}

export const Menu = ({
  login,
  doneDays,
  onDoneDays,
  notify,
  onNotify,
  sound,
  onSound,
  permission,
  openMode,
  onOpenMode,
  views,
  onViews,
  order,
  onOrder,
}: {
  login?: string
  doneDays: 7 | 14 | 30
  onDoneDays: (days: 7 | 14 | 30) => void
  notify: boolean
  onNotify: (on: boolean) => void
  sound: boolean
  onSound: (on: boolean) => void
  permission: "unsupported" | "default" | "granted" | "denied"
  openMode: OpenMode
  onOpenMode: (mode: OpenMode) => void
  views: View[]
  onViews: (next: View[]) => void
  order: "urgency" | "name"
  onOrder: (next: "urgency" | "name") => void
}) => {
  const picker = useRef<HTMLInputElement>(null)
  const [moved, setMoved] = useState<string>()
  const [contrast, setContrast] = useState(false)
  const [still, setStill] = useState(false)
  const [theme, setTheme] = useState<Theme>("auto")

  useEffect(() => {
    try {
      const on = localStorage.getItem(CONTRAST) === "1"
      setContrast(on)
      document.documentElement.dataset.contrast = on ? "high" : ""

      /* Unset means follow the operating system, which is what `layout.tsx`
         already resolved before paint. Read the result rather than the
         preference, so the switch shows what is actually in force. */
      setStill(document.documentElement.dataset.motion === "reduce")

      const saved = (localStorage.getItem(THEME) as Theme | null) ?? "auto"
      setTheme(saved)
      document.documentElement.dataset.theme = saved
      paintChrome(saved)
    } catch {
      /* Storage refused. The default look is the correct fallback. */
    }
  }, [])

  /* Following the system means following it as it changes, not only at load. */
  useEffect(() => {
    if (theme !== "auto") return
    const media = matchMedia("(prefers-color-scheme: light)")
    const follow = () => paintChrome("auto")
    media.addEventListener("change", follow)
    return () => media.removeEventListener("change", follow)
  }, [theme])

  const chooseTheme = (next: Theme) => {
    setTheme(next)
    document.documentElement.dataset.theme = next
    paintChrome(next)
    try {
      localStorage.setItem(THEME, next)
    } catch {}
  }

  const toggleMotion = () => {
    const next = !still
    setStill(next)
    document.documentElement.dataset.motion = next ? "reduce" : ""
    try {
      localStorage.setItem(MOTION, next ? "1" : "0")
    } catch {}
  }

  const toggleContrast = () => {
    const next = !contrast
    setContrast(next)
    document.documentElement.dataset.contrast = next ? "high" : ""
    try {
      localStorage.setItem(CONTRAST, next ? "1" : "0")
    } catch {}
  }

  const link =
    "flex items-center gap-2 rounded-lg px-2 py-2 text-[14px] text-fg-mute hover:bg-raise hover:text-fg"

  return (
    <>
      {/*
        The trigger is his face rather than three lines.

        A burger is a container for whatever could not be placed; an avatar is a
        container for YOU — and it answers "who is signed in" simply by being
        there, before anyone taps it. The primary ask is served by the
        affordance, not by its contents.
      */}
      <button
        type="button"
        popoverTarget={ID}
        aria-label={login ? `Menu — signed in as ${login}` : "Menu"}
        className="grid size-8 shrink-0 place-items-center overflow-hidden rounded-full border border-line text-fg-mute hover:border-accent hover:text-fg"
      >
        {login ? (
          <img
            src={`https://github.com/${login}.png?size=128`}
            alt=""
            width={32}
            height={32}
            className="size-full object-cover"
          />
        ) : (
          <span aria-hidden className="text-[14px] leading-none">
            ☰
          </span>
        )}
      </button>

      <div
        id={ID}
        popover="auto"
        /*
          Bottom sheet on a phone, anchored card on a desk — the same two-frame
          pattern as the filter, so there is one behaviour to learn. And now the
          same INTERNAL one: a bounded frame with the list scrolling inside it.
          A popover has no default height limit, so this grew with every section
          added until it ran off the top of a phone and took the identity row —
          the one thing the menu exists to show first — with it.
        */
        className="m-0 mt-auto flex max-h-[85dvh] w-full flex-col overflow-hidden rounded-t-2xl border border-line bg-panel p-3 text-fg shadow-[0_-20px_60px_-30px_rgba(0,0,0,.9)] backdrop:bg-black/40 md:m-auto md:mr-6 md:mt-16 md:max-h-[80dvh] md:w-[300px] md:rounded-2xl"
      >
        {login ? (
          <div className="flex shrink-0 items-center gap-2.5 px-2 pb-3">
            {/* A stable URL off the login we already have — nothing new fetched
                to know who is signed in. */}
            <img
              src={`https://github.com/${login}.png?size=144`}
              alt=""
              width={36}
              height={36}
              className="size-9 rounded-full border border-line"
            />
            <div className="min-w-0">
              <p className="truncate text-[14px] font-semibold">@{login}</p>
              <p className="text-[12px] text-fg-quiet">Signed in with GitHub</p>
            </div>
          </div>
        ) : null}

        {/* The list, and the only part that moves. `min-h-0` is what lets a flex
            child shrink below its content; without it the frame's height is a
            suggestion and the overflow goes back to being a clip. */}
        <div className="fade-b -mx-1 min-h-0 flex-1 overflow-y-auto px-1 pb-4">
          <div className="border-t border-line-soft pt-2">
            {login ? (
              <>
                <a
                  className={link}
                  href={`https://github.com/${login}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Your profile{" "}
                  <span aria-hidden className="ml-auto">
                    ↗
                  </span>
                </a>
                <a
                  className={link}
                  href="https://github.com/pulls"
                  target="_blank"
                  rel="noreferrer"
                >
                  Your pull requests{" "}
                  <span aria-hidden className="ml-auto">
                    ↗
                  </span>
                </a>
                {/* The archive, owned by the thing that already does it well. */}
                <a
                  className={link}
                  href={`https://github.com/search?q=involves%3A${login}+is%3Aclosed&type=issues&s=updated`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Closed recently{" "}
                  <span aria-hidden className="ml-auto">
                    ↗
                  </span>
                </a>
              </>
            ) : null}
          </div>

          <div className="mt-2 border-t border-line-soft pt-2">
            <p className="px-2 pb-1 font-mono text-[10px] uppercase tracking-[0.14em] text-fg-quiet">
              Settings
            </p>

            {/*
             * Only while the app is open, and the label says so.
             *
             * Anything else means Web Push: a service worker handler, a key pair,
             * a store of subscriptions, and something scheduled asking GitHub on
             * your behalf while nobody is looking — which is exactly the spend the
             * polling work went to remove. Promising "notifications" and
             * delivering only the open-tab kind would be the lie; naming it is
             * free.
             */}
            <button
              type="button"
              onClick={() => onNotify(!notify)}
              aria-pressed={notify}
              disabled={permission === "denied" || permission === "unsupported"}
              className={`${link} w-full disabled:opacity-50`}
            >
              <span className="text-left">
                Notify me
                <span className="block text-[11.5px] text-fg-quiet">
                  {permission === "denied"
                    ? "Blocked in your browser settings"
                    : permission === "unsupported"
                      ? "Not supported here"
                      : "While the app is open"}
                </span>
              </span>
              <span
                aria-hidden
                className={`ml-auto shrink-0 rounded-full border px-2 py-px text-[11px] ${
                  notify
                    ? "border-accent bg-accent-dim text-accent"
                    : "border-line text-fg-quiet"
                }`}
              >
                {notify ? "On" : "Off"}
              </span>
            </button>

            <button
              type="button"
              onClick={() => onSound(!sound)}
              aria-pressed={sound}
              disabled={!notify}
              className={`${link} w-full disabled:opacity-50`}
            >
              Sound
              <span
                aria-hidden
                className={`ml-auto rounded-full border px-2 py-px text-[11px] ${
                  sound
                    ? "border-accent bg-accent-dim text-accent"
                    : "border-line text-fg-quiet"
                }`}
              >
                {sound ? "On" : "Off"}
              </span>
            </button>

            {/* Desktop only, and now for a narrower reason than before: a row
              opens in place at every width, but WHICH shape it takes is a desk
              question. At 390px a side panel at 92vw is a full screen wearing a
              border and a modal is one with margins, so a phone always gets the
              screen and has nothing to choose between. */}
            {/*
              Where a row opens, and it is one setting with two faces because
              the question genuinely differs by device.

              On a phone there are two answers — in here, or hand over to the
              GitHub app — and the three panel shapes are indistinguishable
              anyway, since all of them take the screen at 390px. On a desk
              there are four, because the shape is a real choice there.

              Same key either way, so a phone choosing "In app" and a desk
              choosing "Side" are not two settings that can disagree.
            */}
            <div className="flex items-center gap-2 px-2 py-2 text-[14px] text-fg-mute md:hidden">
              Open rows
              <span className="ml-auto flex overflow-hidden rounded-lg border border-line">
                {(
                  [
                    { id: "full", label: "In app" },
                    { id: "github", label: "GitHub" },
                  ] as const
                ).map((option) => {
                  const on =
                    option.id === "github"
                      ? openMode === "github"
                      : openMode !== "github"
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => onOpenMode(option.id)}
                      aria-pressed={on}
                      className={`px-2 py-0.5 text-[12px] ${
                        on ? "bg-accent-dim text-accent" : "text-fg-quiet"
                      }`}
                    >
                      {option.label}
                    </button>
                  )
                })}
              </span>
            </div>

            <div className="hidden items-center gap-2 px-2 py-2 text-[14px] text-fg-mute md:flex">
              Open as
              <span className="ml-auto flex overflow-hidden rounded-lg border border-line">
                {(["side", "modal", "full", "github"] as const).map(
                  (option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => onOpenMode(option)}
                      aria-pressed={openMode === option}
                      className={`px-2 py-0.5 text-[12px] capitalize ${
                        openMode === option
                          ? "bg-accent-dim text-accent"
                          : "text-fg-quiet"
                      }`}
                    >
                      {option}
                    </button>
                  ),
                )}
              </span>
            </div>

            {/*
              Two states, and the default is the app's name rather than a
              preference: what wants you comes first. `Name` is here for the
              opposite arrival — looking for one project rather than reading
              down what is in front of you — and it is the only alternative
              that stores a RULE rather than a photograph of a set. A
              hand-ordered list would rot on its own as repos are renamed or
              created, and a repo missing from it would land at the bottom,
              which on this board means new work hidden under everything.
            */}
            <div className="flex items-center gap-2 px-2 py-2 text-[14px] text-fg-mute">
              Order
              <span className="ml-auto flex overflow-hidden rounded-lg border border-line">
                {(["urgency", "name"] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => onOrder(option)}
                    aria-pressed={order === option}
                    className={`px-2 py-0.5 text-[12px] capitalize ${
                      order === option
                        ? "bg-accent-dim text-accent"
                        : "text-fg-quiet"
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </span>
            </div>

            <div className="flex items-center gap-2 px-2 py-2 text-[14px] text-fg-mute">
              Theme
              <span className="ml-auto flex overflow-hidden rounded-lg border border-line">
                {(["auto", "light", "dark"] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => chooseTheme(option)}
                    aria-pressed={theme === option}
                    className={`px-2 py-0.5 text-[12px] capitalize ${
                      theme === option
                        ? "bg-accent-dim text-accent"
                        : "text-fg-quiet"
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </span>
            </div>

            {/*
             * Kept alongside the light theme rather than replaced by it: they
             * answer different failures. Light is for a bright room; this is for
             * direct sunlight on the dark theme, where the quiet tones go first
             * and the sky's washes eat what contrast is left. The palette is calibrated against
             * near-black — the accent reads about 7:1 there and under 3:1 on
             * white, which is a failure exactly where colour carries meaning —
             * and the sky is additive glow, which is invisible on a light ground.
             * A light theme is a second design, not a recolour.
             *
             * What that request is usually reaching for is daylight, and this
             * serves it directly: quiet tones raised, sky off.
             */}
            <button
              type="button"
              onClick={toggleContrast}
              aria-pressed={contrast}
              className={`${link} w-full`}
            >
              Higher contrast
              <span
                aria-hidden
                className={`ml-auto rounded-full border px-2 py-px text-[11px] ${
                  contrast
                    ? "border-accent bg-accent-dim text-accent"
                    : "border-line text-fg-quiet"
                }`}
              >
                {contrast ? "On" : "Off"}
              </span>
            </button>

            {/*
             * Comfort and speed at once, which is why it is worth its own switch
             * rather than being left to the system setting alone.
             *
             * Off go the transitions, the popover backdrop blur — the one effect
             * here that makes a whole viewport recomposite — and the drifting
             * sky, which stops rather than merely hiding. It starts wherever the
             * operating system has it and stays wherever you put it.
             */}
            <button
              type="button"
              onClick={toggleMotion}
              aria-pressed={still}
              className={`${link} w-full`}
            >
              <span className="text-left">
                Reduce motion
                <span className="block text-[11.5px] text-fg-quiet">
                  Faster on a slow machine
                </span>
              </span>
              <span
                aria-hidden
                className={`ml-auto shrink-0 rounded-full border px-2 py-px text-[11px] ${
                  still
                    ? "border-accent bg-accent-dim text-accent"
                    : "border-line text-fg-quiet"
                }`}
              >
                {still ? "On" : "Off"}
              </span>
            </button>

            <div className="flex items-center gap-2 px-2 py-2 text-[14px] text-fg-mute">
              Recently done
              <span className="ml-auto flex overflow-hidden rounded-lg border border-line">
                {([7, 14, 30] as const).map((days) => (
                  <button
                    key={days}
                    type="button"
                    onClick={() => onDoneDays(days)}
                    aria-pressed={doneDays === days}
                    className={`px-2 py-0.5 text-[12px] ${
                      doneDays === days
                        ? "bg-accent-dim text-accent"
                        : "text-fg-quiet"
                    }`}
                  >
                    {days}d
                  </button>
                ))}
              </span>
            </div>
          </div>

          {/*
          Saved views travel as a file.

          They live in this browser's storage, which means they do not follow
          him to the other device — and that limit is stated here rather than
          hidden, because a preference that silently exists on one machine is
          worse than one that visibly has to be carried.

          A file rather than a sync, for now: syncing without a database is
          possible — a private gist is free, is his own data, and reaches every
          device — but it costs a wider OAuth scope, which is a decision rather
          than a detail. This is the same JSON that mechanism would move, so
          nothing here is thrown away when it is taken.
        */}
          <div className="mt-2 border-t border-line-soft pt-2">
            <p className="px-2 pb-1 font-mono text-[10px] uppercase tracking-[0.14em] text-fg-quiet">
              Saved views
            </p>

            <button
              type="button"
              disabled={!views.length}
              onClick={() => {
                const blob = new Blob([exportViews(views)], {
                  type: "application/json",
                })
                const url = URL.createObjectURL(blob)
                const a = document.createElement("a")
                a.href = url
                a.download = "your-move-views.json"
                a.click()
                URL.revokeObjectURL(url)
                setMoved(`Exported ${views.length}`)
              }}
              className={`${link} w-full disabled:opacity-50`}
            >
              Export
              <span aria-hidden className="ml-auto font-mono text-[11px]">
                {views.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => picker.current?.click()}
              className={`${link} w-full`}
            >
              Import
            </button>

            {/* Merged by name rather than replacing the lot: importing on a
                second device should add what is missing, not erase what is
                already there. */}
            <input
              ref={picker}
              type="file"
              accept="application/json,.json"
              hidden
              onChange={async (event) => {
                const file = event.target.files?.[0]
                event.target.value = ""
                if (!file) return
                try {
                  const incoming = importViews(await file.text())
                  if (!incoming.length) return setMoved("Nothing in that file")
                  const names = new Set(incoming.map((v) => v.name))
                  onViews([
                    ...views.filter((v) => !names.has(v.name)),
                    ...incoming,
                  ])
                  setMoved(`Imported ${incoming.length}`)
                } catch {
                  setMoved("That file could not be read")
                }
              }}
            />

            {moved ? (
              <p className="px-2 pt-1 text-[11.5px] text-fg-quiet">{moved}</p>
            ) : null}
          </div>

          {/*
          The footer, for the width that does not have one.

          Narrow drops the footer on purpose — it is the least urgent thing on
          a phone screen and it was costing board height. But "not shown" and
          "not reachable" are different, and these are the only links out to the
          project itself. `md:hidden`, because above that the footer carries
          them and a menu repeating what is already on the page is noise.
        */}
          <div className="mt-2 border-t border-line-soft pt-2 md:hidden">
            <p className="px-2 pb-1 font-mono text-[10px] uppercase tracking-[0.14em] text-fg-quiet">
              Your Move
            </p>
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
                className={link}
                href={out.href}
                target="_blank"
                rel="noreferrer"
              >
                {out.label}
                <span aria-hidden className="ml-auto">
                  ↗
                </span>
              </a>
            ))}
          </div>

          {/* Signing out clears the device too. `ym:last` is a full board and
            `ym:perms` is a map of what you may write to — both private, both
            outliving a logout that only ever cleared the cookie, on a phone
            somebody else might pick up. */}
          <form
            onSubmit={() => {
              try {
                localStorage.removeItem("ym:last")
                localStorage.removeItem("ym:perms")
                sessionStorage.removeItem("ym:scroll")
              } catch {}
            }}
            action="/api/auth/logout"
            method="post"
            className="mt-2 border-t border-line-soft pt-2"
          >
            <button type="submit" className={`${link} w-full`}>
              Sign out
            </button>
          </form>

          {/* The provenance line, in the place someone actually looks for it. */}
          <p className="px-2 pb-1 pt-3 text-[11.5px] leading-[1.5] text-fg-quiet">
            Read live from GitHub, cached for five minutes. Nothing is stored;
            labels are the only thing this app writes back.
          </p>

          {/*
            What you are running, and where the notes are.

            Two facts rather than one: the version is what was released, the
            short SHA is what is actually on your screen. They usually agree —
            and on the day a deploy lags they do not, which is the day this line
            earns its place. Chasing a bug that turned out to be an old bundle
            cost twenty minutes once; it would have cost a glance.
          */}
          <a
            href="https://github.com/kud/your-move/releases"
            target="_blank"
            rel="noreferrer"
            className="mt-1 block px-2 pb-1 font-mono text-[11px] text-fg-quiet hover:text-fg-mute"
          >
            v{process.env.NEXT_PUBLIC_VERSION}
            {process.env.NEXT_PUBLIC_COMMIT
              ? ` · ${process.env.NEXT_PUBLIC_COMMIT}`
              : " · dev"}
            <span aria-hidden> ↗</span>
          </a>
        </div>
      </div>
    </>
  )
}
