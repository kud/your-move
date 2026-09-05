/*
 * Presentation only.
 *
 * Order and membership are decided by `@kud/gh`'s INBOX_SOURCES and
 * `whoseMove`. This map says only how a section *looks* — so a source added to
 * the library tomorrow renders with the fallback rather than vanishing.
 *
 * Each glyph is a distinct shape. Colour only reinforces what the shape already
 * says, so the board survives being read without it.
 *
 * That last paragraph stopped being true for four days and nothing said so.
 * `d353abe` split the labels into type/status axes and renamed every section;
 * this map kept the pre-split keys, so ten of twelve columns fell through to
 * FALLBACK and rendered the same `•` in the same tone. A fallback is
 * indistinguishable from a design decision, which is the whole reason the
 * silence lasted — and why `co doctor` should be asserting this (#11).
 */

/**
 * `meaning` says what the section *is*, in the second person, for someone who
 * did not design the taxonomy. `empty` says what its absence means.
 *
 * They are different sentences on purpose: "Nothing is waiting on you" is a
 * fact about today, and "only you can clear it" is the rule. A board read from
 * a phone, weeks after the vocabulary was decided, needs the rule available —
 * the glyphs are distinct but they are not self-explanatory.
 */
export type Presentation = {
  glyph: string
  tone: string
  empty: string
  meaning: string
}

const PRESENTATION: Record<string, Presentation> = {
  /* Every section is a shape of GitHub fact. Nothing here is a commitment with
     an owner or a wake condition — that vocabulary belonged to the Company
     board this grew out of, and it went with it. */
  review: {
    glyph: "◇",
    tone: "accent",
    empty: "Nothing awaiting your review.",
    meaning: "Someone has asked you to review their pull request.",
  },
  open: {
    glyph: "↑",
    tone: "slate",
    empty: "No open PRs.",
    meaning: "Your own pull requests, open and out for review.",
  },
  draft: {
    glyph: "▫",
    tone: "slate",
    empty: "No drafts.",
    meaning:
      "Your pull requests still marked draft — not yet asking anything of anyone.",
  },
  incoming: {
    glyph: "↓",
    tone: "slate",
    empty: "Nothing incoming.",
    meaning: "Pull requests other people have opened on your repositories.",
  },
  assigned: {
    glyph: "@",
    tone: "slate",
    empty: "Nothing assigned to you.",
    meaning: "Issues assigned to you on GitHub, wherever they live.",
  },
  reviewed: {
    glyph: "◆",
    tone: "slate",
    empty: "Nothing reviewed lately.",
    meaning:
      "Pull requests you have reviewed recently — here so a thread you replied to does not vanish.",
  },
  issues: {
    glyph: "○",
    tone: "slate",
    empty: "No open issues.",
    meaning:
      "Open issues on repositories you own.",
  },
  done: {
    glyph: "✓",
    tone: "sage",
    empty: "Nothing closed yet.",
    meaning: "Closed recently. Kept briefly so you can see what moved.",
  },
}

const FALLBACK: Presentation = {
  glyph: "•",
  tone: "slate",
  empty: "Nothing here.",
  meaning: "A section this board does not have a description for yet.",
}

export const presentationFor = (key: string): Presentation =>
  PRESENTATION[key] ?? FALLBACK

/*
 * Exported for the contract test only, which checks both directions: a section
 * the CLI emits and this map has forgotten renders the fallback, and a key kept
 * here after the CLI dropped it is dead weight that reads as still supported.
 * The first is what cost four days; the second is how the map got stale enough
 * for it to happen.
 */
export const PRESENTED_SECTIONS = Object.keys(PRESENTATION)
