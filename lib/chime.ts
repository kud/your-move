/*
 * A short two-note chime, synthesised rather than shipped.
 *
 * No asset, so nothing to download, nothing to cache, and nothing that can 404
 * — and it is a few hundred bytes of code against a few tens of kilobytes of
 * audio for a sound that plays for a fifth of a second.
 *
 * Rising rather than falling: two notes going up read as "something arrived",
 * where a descending pair reads as dismissal or error. The board only ever
 * chimes for work crossing INTO your side, so it should sound like arrival.
 */

let context: AudioContext | undefined

/*
 * Browsers refuse to start an AudioContext without a user gesture, and a
 * context created before one is stuck in `suspended` forever. So the first call
 * is expected to come from a tap — turning the setting on — and later automatic
 * chimes reuse the unlocked context.
 */
export const unlockChime = () => {
  try {
    context ??= new AudioContext()
    if (context.state === "suspended") void context.resume()
  } catch {
    /* No Web Audio. The notification still fires; it is simply silent. */
  }
}

const note = (at: number, hz: number, length: number) => {
  if (!context) return

  const osc = context.createOscillator()
  const gain = context.createGain()

  /* A sine, because anything richer sounds like a games console at this
     length. */
  osc.type = "sine"
  osc.frequency.value = hz

  /* Ramped rather than switched: a gain that jumps produces a click at both
     ends, which is most of what makes a synthesised tone sound cheap. */
  gain.gain.setValueAtTime(0.0001, at)
  gain.gain.exponentialRampToValueAtTime(0.16, at + 0.012)
  gain.gain.exponentialRampToValueAtTime(0.0001, at + length)

  osc.connect(gain).connect(context.destination)
  osc.start(at)
  osc.stop(at + length + 0.02)
}

export const chime = () => {
  try {
    unlockChime()
    if (!context || context.state !== "running") return

    const now = context.currentTime
    /* E5 then B5 — a rising fifth, which is about as neutral as an interval
       gets while still sounding deliberate. */
    note(now, 659.25, 0.14)
    note(now + 0.1, 987.77, 0.2)
  } catch {
    /* Silence is an acceptable failure for a sound. */
  }
}
