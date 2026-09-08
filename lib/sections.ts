import type { InboxSource } from "@kud/gh"

/*
 * Presentation only.
 *
 * Order and membership are decided by `@kud/gh`'s INBOX_SOURCES and
 * `whoseMove`. This map says only how a section *looks* — so a source added to
 * the library tomorrow renders with the fallback rather than vanishing.
 *
 * The mark for each section lives in `components/section-mark.tsx`, drawn
 * rather than typed — a text glyph's size and vertical placement are whatever
 * the installed font thinks, and on Android three of these were being drawn by
 * a fallback face. Colour only reinforces what the shape already says, so the
 * board survives being read without it.
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
  /** The column heading. Rendering the key gave columns headed "Open". */
  title: string
  tone: string
  empty: string
  meaning: string
}

const PRESENTATION: Record<string, Presentation> = {
  /* Every section is a shape of GitHub fact. Nothing here is a commitment with
     an owner or a wake condition — that vocabulary belonged to the earlier
     board this grew out of, and it went with it. */
  review: {
    title: "Review requested",
    tone: "accent",
    empty: "Nothing awaiting your review.",
    meaning: "Someone has asked you to review their pull request.",
  },
  open: {
    title: "Your pull requests",
    tone: "slate",
    empty: "No open PRs.",
    meaning: "Your own pull requests, open and out for review.",
  },
  incoming: {
    title: "Incoming",
    tone: "slate",
    empty: "Nothing incoming.",
    meaning: "Pull requests other people have opened on your repositories.",
  },
  assigned: {
    title: "Assigned to you",
    tone: "slate",
    empty: "Nothing assigned to you.",
    meaning: "Issues assigned to you on GitHub, wherever they live.",
  },
  reviewed: {
    title: "Reviewed",
    tone: "slate",
    empty: "Nothing reviewed lately.",
    meaning:
      "Pull requests you have reviewed recently — here so a thread you replied to does not vanish.",
  },
  issues: {
    title: "Open issues",
    tone: "slate",
    empty: "No open issues.",
    meaning:
      "Open issues on repositories you own.",
  },
  done: {
    title: "Recently done",
    tone: "sage",
    empty: "Nothing closed yet.",
    meaning: "Closed recently. Kept briefly so you can see what moved.",
  },
}

const FALLBACK: Presentation = {
  title: "Other",
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

/*
 * What a failed SOURCE is called, which is a different vocabulary from a
 * section and has to be translated rather than printed.
 *
 * `inbox.failed` carries `@kud/gh`'s own query ids — `myPRs`, `reviewRequests`
 * — and the failure notice was rendering them raw, so the one message whose job
 * is to tell you which part of the board you cannot trust was naming it in a
 * vocabulary that exists nowhere on the board. Several sources also feed one
 * column, so this is a real mapping rather than a case conversion.
 *
 * `Record<InboxSource, string>` on purpose, and NOT a lookup with a fallback:
 * the union is exported by the library, so a source added there fails the
 * typecheck here instead of quietly printing its id. That is the lesson from
 * the header of this file — a fallback is indistinguishable from a design
 * decision, and the silence is what costs the days.
 */
export const SOURCE_TITLES: Record<InboxSource, string> = {
  myPRs: "Your pull requests",
  reviewRequests: "Review requested",
  reviewed: "Reviewed",
  assigned: "Assigned to you",
  repoIssues: "Open issues",
  authoredIssues: "Issues you opened",
  repoPRs: "Incoming",
  recentlyDone: "Recently done",
}

export const sourceTitle = (source: string) =>
  SOURCE_TITLES[source as InboxSource] ?? source

/*
 * How long a row may sit in a column before the card says so.
 *
 * Per column, because "too long" is a fact about the column and not about the
 * row: a review request at four days is someone waiting on you, and the same
 * four days in `done` is simply history. A single global age would mark the
 * wrong things, and mostly it would mark the archive.
 *
 * `done` is deliberately absent, and absence rather than a large number is the
 * honest way to say it — there is no age at which a finished thing becomes a
 * problem, so there is no threshold to tune. The bands are days, and they widen
 * as the column's business gets less urgent: something addressed to you ages
 * fast, something you filed yourself ages slowly.
 */
export const STALE_AFTER: Record<string, { warm: number; hot: number }> = {
  /* Somebody cannot land their work until you look. */
  review: { warm: 2, hot: 5 },
  incoming: { warm: 3, hot: 7 },
  /* Your own PR: past a week it has usually stopped being in flight. */
  open: { warm: 3, hot: 7 },
  /* You have done your part; this is how long they have not done theirs. */
  reviewed: { warm: 3, hot: 10 },
  assigned: { warm: 7, hot: 21 },
  issues: { warm: 14, hot: 45 },
}

export type Heat = "warm" | "hot"

const DAY = 86_400_000

/*
 * Measured from the row's own recency stamp against the moment of the READ, not
 * against the clock.
 *
 * Two reasons, and the second is the one that would have bitten. The board's
 * whole posture is "here is the answer, and here is how old it is", so heat
 * derived from the same instant as the rest of the answer is consistent with it.
 * And a heat computed from `Date.now()` in render would be computed twice — once
 * on the server, once on the client — which for any row sitting within a
 * hairsbreadth of a threshold means the two disagree and React reports a
 * hydration mismatch on a card that is merely a day old.
 *
 * `ts` is the same stamp the board sorts by, so the cards that go hot are the
 * ones already sinking to the bottom of their column. It is 0 rather than
 * undefined when the item had no date to sort on — which is 1970, and would set
 * every one of them alight.
 */
export const heatOf = (
  column: string,
  ts: number,
  now?: number,
): Heat | undefined => {
  const band = STALE_AFTER[column]
  if (!band || !now || !ts) return undefined
  const days = (now - ts) / DAY
  if (days >= band.hot) return "hot"
  if (days >= band.warm) return "warm"
  return undefined
}
