"use client"

/*
 * The cold-open intro: the blue half hops into the white one, the joined mark
 * keeps hopping while GitHub is read, then lands in the header slot.
 *
 * Every number and every keyframe is argued beside the CSS in `app/globals.css`
 * (`THE INTRO`). What lives here is only the part CSS cannot know: when the read
 * is done, when to stop the loop, and the landing, which needs two measurements.
 *
 * The CSS animations start at first paint, before this hydrates, so a slow
 * bundle never leaves the mark sitting still. The overlay is always in the SSR
 * output and `:root[data-intro]` is what shows it; hydrating without that
 * attribute (every refresh) renders nothing at all.
 *
 * Never delays the read: Booting renders underneath as the Suspense fallback and
 * the board streams in exactly as it did. This is a sibling BEFORE the
 * Suspense in `app/page.tsx`, because Booting unmounts when the board arrives
 * and would take the loop with it mid-hop.
 */

import { useEffect, useRef, useState } from "react"

import { LEFT, RIGHT } from "@/components/mark"

/* Twins of `--dur-intro` and friends in `app/globals.css`; change one, change
   the other. */
const HOP_MS = 720 // --dur-intro
const TRAVEL_MS = 320 // --dur-sheet
const SETTLE_MS = 220 // --dur-settle
const FADE_MS = 180 // --dur-fade
const CROUCH_MS = 100
const CAP_MS = 6000

/* Past six seconds a hopping logo stops being charming and starts hiding the
   one honest status line on screen, Booting's "Reading GitHub". */

/* A tap or key fast-forwards rather than snaps: the next hop boundary still
   lands it, so nothing ever jumps mid-air. */
const SKIP_RATE = 4

type Phase = "cold" | "hopping" | "landing" | "still" | "done"

let ready = false
const waiting = new Set<() => void>()

/* Called by `Inbox` once there is something TRUE to show: rows, or a failure
   that is itself the answer. Idempotent, and a late subscriber hears it too. */
export const markBoardReady = () => {
  if (ready) return
  ready = true
  waiting.forEach((fn) => fn())
  waiting.clear()
}

const whenBoardReady = (fn: () => void) => {
  if (ready) {
    fn()
    return () => {}
  }
  waiting.add(fn)
  return () => void waiting.delete(fn)
}

/* The header mark that is on screen: Booting's or the board's, whichever is
   mounted. Both sit at the same spot, by the no-reflow guarantee in
   `components/booting.tsx`. */
const visibleSlot = () =>
  [...document.querySelectorAll<HTMLElement>("[data-mark-slot]")].find(
    (el) => el.getClientRects().length,
  )

export const Intro = () => {
  const [phase, setPhase] = useState<Phase>("cold")
  const phaseRef = useRef<Phase>("cold")
  const root = useRef<HTMLDivElement>(null)
  const latched = useRef(false)
  const leaving = useRef(false)

  /* The attribute is written directly as well as through state: the CSS that cuts
     the loop must apply before the next frame, and a state update is not
     promised to commit that soon. React then writes the same value. */
  const go = (next: Phase) => {
    phaseRef.current = next
    if (root.current) root.current.dataset.phase = next
    setPhase(next)
  }

  const part = (selector: string) =>
    root.current?.querySelector<HTMLElement>(selector) ?? null

  /* Reveals the real header mark and unmounts the overlay in the same frame. */
  const finish = () => {
    if (phaseRef.current === "done") return
    delete document.documentElement.dataset.intro
    go("done")
  }

  /* `element.animate()` rather than a CSS transition, deliberately. Under
     `data-motion="reduce"` the global kill in `app/globals.css` forces every CSS
     `animation-duration` and `transition-duration` to 0.01ms, so a CSS
     crossfade would cut. The Web Animations API is not subject to it, and a
     fade of 180ms is not the motion that setting asks to be spared. */
  const crossfade = () => {
    const el = root.current
    if (!el) return finish()
    if (leaving.current) return
    leaving.current = true
    el.style.pointerEvents = "none"
    /* The header mark comes back under the fading overlay, so it crossfades
       too instead of popping in at the end. "out" rather than deleting the
       attribute: the overlay itself is only displayed while it is present. */
    document.documentElement.dataset.intro = "out"
    /* From wherever the CSS bail has already taken it, when hydration came
       late enough to catch that mid-fade. */
    const from = Number(getComputedStyle(el).opacity)
    el.animate([{ opacity: from }, { opacity: 0 }], {
      duration: FADE_MS,
      easing: "ease-out",
      fill: "forwards",
    }).finished.then(finish, finish)
  }

  const land = () => {
    const el = root.current
    if (!el || phaseRef.current !== "hopping") return
    go("landing")

    const stage = part(".ym-intro-stage")
    const slot = visibleSlot()
    if (!stage || !slot) return crossfade()

    /* A landing that cannot run must not leave the overlay standing over a
       board it no longer lets anyone touch. */
    try {
      flyTo(stage, slot)
    } catch {
      crossfade()
    }
  }

  const flyTo = (stage: HTMLElement, slot: HTMLElement) => {
    /* The one layout read: nothing per frame after this. */
    const s = stage.getBoundingClientRect()
    const t = slot.getBoundingClientRect()
    const dx = t.left + t.width / 2 - (s.left + s.width / 2)
    const dy = t.top + t.height / 2 - (s.top + s.height / 2)
    const scale = t.width / s.width

    const play = (
      selector: string,
      keyframes: Keyframe[],
      options: KeyframeAnimationOptions,
    ) =>
      /* "both", not "forwards": the shadow's fade waits out the crouch, and
         without the backwards fill it would sit at its unanimated opacity
         for those 100ms rather than where the loop left it. */
      part(selector)?.animate(keyframes, { fill: "both", ...options })

    const travel = { duration: TRAVEL_MS, delay: CROUCH_MS }

    const animations = [
      play(
        ".ym-intro-squash",
        [
          {
            offset: 0,
            transform: "scale(1, 1)",
            easing: "cubic-bezier(0.3, 0, 0.2, 1)",
          },
          {
            offset: 0.16,
            transform: "scale(1.1, 0.86)",
            easing: "ease-out",
          },
          {
            offset: 0.4,
            transform: "scale(0.92, 1.1)",
            easing: "ease-in",
          },
          {
            offset: 0.66,
            transform: "scale(1.12, 0.88)",
            easing: "cubic-bezier(0.3, 0, 0.3, 1)",
          },
          {
            offset: 0.84,
            transform: "scale(0.98, 1.02)",
            easing: "ease-out",
          },
          { offset: 1, transform: "scale(1, 1)" },
        ],
        { duration: CROUCH_MS + TRAVEL_MS + SETTLE_MS },
      ),
      play(
        ".ym-intro-travel-x",
        [{ transform: "translateX(0)" }, { transform: `translateX(${dx}px)` }],
        { ...travel, easing: "cubic-bezier(0.4, 0, 0.6, 1)" },
      ),
      /* Rises fast, overshoots about 18% above the slot and drops into it: the
         landing-from-above arc. */
      play(
        ".ym-intro-travel-y",
        [{ transform: "translateY(0)" }, { transform: `translateY(${dy}px)` }],
        { ...travel, easing: "cubic-bezier(0.2, 0.9, 0.35, 1.18)" },
      ),
      play(
        ".ym-intro-travel-s",
        [{ transform: "scale(1)" }, { transform: `scale(${scale})` }],
        { ...travel, easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
      ),
      /* The board is revealed while the mark is in flight, so it lands into a
         visible header rather than onto a blank screen. */
      play(".ym-intro-ground", [{ opacity: 1 }, { opacity: 0 }], {
        duration: FADE_MS,
        delay: CROUCH_MS + 40,
        easing: "ease-out",
      }),
      /* The mark leaves the floor. */
      play(".ym-intro-shadow", [{ opacity: 0.85 }, { opacity: 0 }], {
        duration: CROUCH_MS,
        delay: CROUCH_MS,
        easing: "ease-in",
      }),
    ].filter((animation): animation is Animation => animation !== undefined)

    Promise.all(animations.map((animation) => animation.finished)).then(
      finish,
      finish,
    )
  }

  /* A hop boundary: the handover ending, or any iteration of the loop. Both
     ends of the loop are rest, so cutting it here is invisible. */
  const boundary = () => {
    if (phaseRef.current === "hopping" && latched.current) land()
  }

  useEffect(() => {
    const el = root.current
    const html = document.documentElement
    if (!el || !html.dataset.intro || document.visibilityState === "hidden") {
      delete html.dataset.intro
      go("done")
      return
    }

    /* Hydrated after the CSS-only bail had begun: leaving `cold` would cancel
       it and bring back an overlay that was already going. Finish its fade
       instead. */
    const bail = el
      .getAnimations()
      .find(
        (animation) =>
          "animationName" in animation &&
          animation.animationName === "ym-intro-bail",
      )
    if (bail?.effect?.getComputedTiming().progress != null) {
      crossfade()
      return
    }

    /* The script has taken over: cancels the CSS-only bail in `globals.css`. */
    html.dataset.intro = "js"
    const reduced = html.dataset.motion === "reduce"
    go(reduced ? "still" : "hopping")

    const latch = () => {
      latched.current = true
      if (reduced) crossfade()
    }

    const skip = () => {
      if (reduced) return crossfade()
      if (phaseRef.current !== "hopping") return
      el.getAnimations({ subtree: true }).forEach((animation) => {
        animation.playbackRate = SKIP_RATE
      })
      latch()
    }

    const hide = () => {
      if (document.visibilityState !== "hidden") return
      /* Nobody watched it; do not replay it later. Infinite animations cannot
         be finished, so those are cancelled. */
      el.getAnimations({ subtree: true }).forEach((animation) => {
        try {
          animation.finish()
        } catch {
          animation.cancel()
        }
      })
      finish()
    }

    const stopWaiting = whenBoardReady(latch)
    const cap = setTimeout(latch, Math.max(0, CAP_MS - performance.now()))
    /* The cap only latches; a boundary still has to come. If the loop's events
       never do (its animation taken away underneath it), land anyway, a beat
       late rather than never. */
    const deadline = setTimeout(
      () => {
        if (phaseRef.current === "hopping") land()
      },
      Math.max(0, CAP_MS + 2 * HOP_MS - performance.now()),
    )
    window.addEventListener("pointerdown", skip, { once: true, passive: true })
    window.addEventListener("keydown", skip, { once: true, passive: true })
    document.addEventListener("visibilitychange", hide)

    /* Late hydration can miss the handover's `animationend`. If it is over and
       the loop has not begun, that boundary has already passed, so land now;
       if the loop is already mid-hop, wait for its next iteration instead. */
    const handover = part(".ym-intro-left-y")?.getAnimations()[0]
    const loop = part(".ym-intro-bob")?.getAnimations()[0]
    if (
      handover?.playState === "finished" &&
      Number(loop?.currentTime ?? 0) <= FADE_MS + HOP_MS
    )
      boundary()

    return () => {
      stopWaiting()
      clearTimeout(cap)
      clearTimeout(deadline)
      window.removeEventListener("pointerdown", skip)
      window.removeEventListener("keydown", skip)
      document.removeEventListener("visibilitychange", hide)
    }
  }, [])

  if (phase === "done") return null

  return (
    <div
      ref={root}
      className="ym-intro"
      aria-hidden
      data-phase={phase}
      onAnimationEnd={(event) => {
        if (event.animationName === "ym-intro-left-y") boundary()
      }}
      onAnimationIteration={(event) => {
        if (event.animationName === "ym-intro-bob") boundary()
      }}
    >
      <div className="ym-intro-ground">
        <div className="ym-intro-aurora ym-intro-aurora-1" />
        <div className="ym-intro-aurora ym-intro-aurora-2" />
        <div className="ym-intro-aurora ym-intro-aurora-3" />
      </div>
      <div className="ym-intro-stage">
        <div className="ym-intro-shadow" />
        <div className="ym-intro-travel-x">
          <div className="ym-intro-travel-y">
            <div className="ym-intro-travel-s">
              <div className="ym-intro-squash">
                <div className="ym-intro-bob">
                  <div className="ym-intro-enter">
                    <div className="ym-intro-half ym-intro-left-x">
                      <div className="ym-intro-left-y">
                        <svg viewBox="0 0 400 352">
                          <path fill="var(--color-brand)" d={LEFT} />
                        </svg>
                      </div>
                    </div>
                    <div className="ym-intro-half ym-intro-right">
                      <svg viewBox="0 0 400 352">
                        <path fill="currentColor" d={RIGHT} />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
