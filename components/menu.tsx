"use client"

import { useEffect, useState } from "react"

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

export const Menu = ({
  login,
  doneDays,
  onDoneDays,
}: {
  login?: string
  doneDays: 7 | 30
  onDoneDays: (days: 7 | 30) => void
}) => {
  const [contrast, setContrast] = useState(false)

  useEffect(() => {
    try {
      const on = localStorage.getItem(CONTRAST) === "1"
      setContrast(on)
      document.documentElement.dataset.contrast = on ? "high" : ""
    } catch {
      /* Storage refused. The default look is the correct fallback. */
    }
  }, [])

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
      <button
        type="button"
        popoverTarget={ID}
        aria-label="Menu"
        className="grid size-8 shrink-0 place-items-center rounded-lg border border-line text-fg-mute hover:text-fg"
      >
        <span aria-hidden className="text-[15px] leading-none">
          ☰
        </span>
      </button>

      <div
        id={ID}
        popover="auto"
        /* Bottom sheet on a phone, anchored card on a desk — the same two-frame
           pattern as the filter, so there is one behaviour to learn. */
        className="m-0 mt-auto w-full rounded-t-2xl border border-line bg-panel p-3 text-fg shadow-[0_-20px_60px_-30px_rgba(0,0,0,.9)] backdrop:bg-black/40 md:m-auto md:mr-6 md:mt-16 md:w-[300px] md:rounded-2xl"
      >
        {login ? (
          <div className="flex items-center gap-2.5 px-2 pb-3">
            {/* A stable URL off the login we already have — nothing new fetched
                to know who is signed in. */}
            <img
              src={`https://github.com/${login}.png?size=80`}
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
           * Not light / dark / auto. The palette is calibrated against
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

          <div className="flex items-center gap-2 px-2 py-2 text-[14px] text-fg-mute">
            Recently done
            <span className="ml-auto flex overflow-hidden rounded-lg border border-line">
              {([7, 30] as const).map((days) => (
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

        <form
          action="/api/auth/logout"
          method="post"
          className="mt-2 border-t border-line-soft pt-2"
        >
          <button type="submit" className={`${link} w-full`}>
            Sign out
          </button>
        </form>

        {/* The provenance line, in the place someone actually looks for it. */}
        <p className="px-2 pt-3 text-[11.5px] leading-[1.5] text-fg-quiet">
          Read live from GitHub, cached for a minute. Nothing is stored; labels
          are the only thing this app writes back.
        </p>
      </div>
    </>
  )
}
