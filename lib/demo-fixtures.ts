import type { InboxSource } from "@kud/gh"
import type { Move } from "@kud/gh-workflow"

import type { Inbox, Row } from "@/lib/github"

/*
 * Sample data for demo mode, and nothing else reads it.
 *
 * Typed as the real `Row` and `Inbox` so a library upgrade that reshapes a row
 * fails the typecheck here instead of serving a board that silently misreads
 * every card. Names are invented — no real people, orgs or repos — because
 * fixtures have a way of being screenshotted.
 *
 * Every source appears at least once, and both sides of the move: your PRs
 * red and waiting, review requests asked and answered, issues open and done.
 */

const hour = 3_600_000
const at = (hoursAgo: number): number => Date.now() - hoursAgo * hour

const row = (
  source: InboxSource,
  move: Move,
  over: Omit<Row, "source" | "move">,
): Row => ({ ...over, source, move })

export const demoRows: Row[] = [
  row("myPRs", "you", {
    kind: "pr",
    number: 214,
    title: "Add rate limiting to token refresh",
    repo: "acme/api-gateway",
    url: "https://github.com/acme/api-gateway/pull/214",
    health: "ci-fail",
    author: "alex-dev",
    lastActor: "sam-ops",
    age: "3h",
    activityAge: "40m",
    ts: at(3),
    unresolved: 2,
    conversation: 9,
    labels: ["backend"],
    additions: 184,
    deletions: 41,
    changedFiles: 7,
    detail: {
      checksPass: 4,
      checksFail: 1,
      checksPending: 0,
      threadsTotal: 2,
    },
  }),
  row("myPRs", "you", {
    kind: "pr",
    number: 209,
    title: "Bump retry backoff on webhook delivery",
    repo: "acme/api-gateway",
    url: "https://github.com/acme/api-gateway/pull/209",
    health: "changes-req",
    author: "alex-dev",
    lastActor: "priya-dev",
    age: "2d",
    activityAge: "5h",
    ts: at(48),
    unresolved: 1,
    conversation: 14,
    labels: ["backend", "needs-tests"],
    additions: 96,
    deletions: 22,
    changedFiles: 4,
    detail: {
      checksPass: 5,
      checksFail: 0,
      checksPending: 0,
      threadsTotal: 1,
      reviewDecision: "CHANGES_REQUESTED",
    },
  }),
  row("myPRs", "them", {
    kind: "pr",
    number: 217,
    title: "Draft: new toggle group",
    repo: "octo-org/widgets",
    url: "https://github.com/octo-org/widgets/pull/217",
    health: "draft",
    author: "alex-dev",
    age: "1d",
    ts: at(24),
    unresolved: 0,
    conversation: 1,
    labels: ["frontend"],
    additions: 210,
    deletions: 18,
    changedFiles: 9,
  }),
  row("reviewRequests", "you", {
    kind: "pr",
    number: 88,
    title: "Fix focus trap in modal",
    repo: "octo-org/widgets",
    url: "https://github.com/octo-org/widgets/pull/88",
    health: "waiting",
    author: "priya-dev",
    lastActor: "priya-dev",
    age: "4d",
    activityAge: "6h",
    ts: at(96),
    unresolved: 0,
    conversation: 6,
    labels: ["frontend", "a11y"],
    additions: 64,
    deletions: 30,
    changedFiles: 3,
    detail: {
      checksPass: 6,
      checksFail: 0,
      checksPending: 0,
      threadsTotal: 0,
    },
  }),
  row("reviewRequests", "you", {
    kind: "pr",
    number: 91,
    title: "Cache avatar URLs for an hour",
    repo: "octo-org/widgets",
    url: "https://github.com/octo-org/widgets/pull/91",
    health: "threads",
    author: "jo-dev",
    lastActor: "jo-dev",
    age: "2d",
    activityAge: "3h",
    ts: at(50),
    unresolved: 3,
    conversation: 11,
    labels: ["frontend"],
    additions: 42,
    deletions: 12,
    changedFiles: 2,
    detail: {
      checksPass: 3,
      checksFail: 0,
      checksPending: 0,
      threadsTotal: 3,
    },
  }),
  row("reviewRequests", "them", {
    kind: "pr",
    number: 219,
    title: "Rotate signing keys without downtime",
    repo: "acme/api-gateway",
    url: "https://github.com/acme/api-gateway/pull/219",
    health: "pending",
    author: "sam-ops",
    age: "5h",
    activityAge: "20m",
    ts: at(5),
    unresolved: 0,
    conversation: 2,
    labels: ["backend", "security"],
    additions: 130,
    deletions: 55,
    changedFiles: 5,
    detail: {
      checksPass: 2,
      checksFail: 0,
      checksPending: 3,
      threadsTotal: 0,
    },
  }),
  row("reviewed", "them", {
    kind: "pr",
    number: 86,
    title: "Lazy-load charts below the fold",
    repo: "octo-org/widgets",
    url: "https://github.com/octo-org/widgets/pull/86",
    health: "approved",
    author: "jo-dev",
    lastActor: "alex-dev",
    age: "6d",
    activityAge: "1d",
    ts: at(144),
    unresolved: 0,
    conversation: 8,
    labels: ["frontend", "perf"],
    additions: 88,
    deletions: 60,
    changedFiles: 6,
    detail: {
      checksPass: 7,
      checksFail: 0,
      checksPending: 0,
      threadsTotal: 0,
      reviewDecision: "APPROVED",
    },
  }),
  row("assigned", "you", {
    kind: "issue",
    number: 342,
    title: "Webhook retries double-fire on timeout",
    repo: "acme/api-gateway",
    url: "https://github.com/acme/api-gateway/issues/342",
    health: "none",
    author: "robin-dev",
    lastActor: "robin-dev",
    age: "3d",
    activityAge: "2h",
    ts: at(72),
    unresolved: 0,
    conversation: 5,
    labels: ["bug"],
  }),
  row("repoIssues", "them", {
    kind: "issue",
    number: 351,
    title: "Rate limit headers missing on 429s",
    repo: "acme/api-gateway",
    url: "https://github.com/acme/api-gateway/issues/351",
    health: "none",
    author: "sam-ops",
    age: "5d",
    ts: at(120),
    unresolved: 0,
    conversation: 2,
    labels: ["backend", "good first issue"],
  }),
  row("repoIssues", "you", {
    kind: "issue",
    number: 348,
    title: "Flaky test: token expiry race",
    repo: "acme/api-gateway",
    url: "https://github.com/acme/api-gateway/issues/348",
    health: "none",
    author: "priya-dev",
    lastActor: "alex-dev",
    age: "4d",
    activityAge: "8h",
    ts: at(100),
    unresolved: 0,
    conversation: 7,
    labels: ["backend", "flaky"],
  }),
  row("authoredIssues", "them", {
    kind: "issue",
    number: 102,
    title: "Modal steals focus on open",
    repo: "octo-org/widgets",
    url: "https://github.com/octo-org/widgets/issues/102",
    health: "none",
    author: "alex-dev",
    lastActor: "jo-dev",
    age: "8d",
    activityAge: "2d",
    ts: at(192),
    unresolved: 0,
    conversation: 4,
    labels: ["frontend", "a11y"],
  }),
  row("repoPRs", "you", {
    kind: "pr",
    number: 221,
    title: "Add request id to error payloads",
    repo: "acme/api-gateway",
    url: "https://github.com/acme/api-gateway/pull/221",
    health: "conflict",
    author: "sam-ops",
    lastActor: "sam-ops",
    age: "1d",
    activityAge: "4h",
    ts: at(26),
    unresolved: 0,
    conversation: 3,
    labels: ["backend"],
    additions: 74,
    deletions: 19,
    changedFiles: 4,
    detail: {
      checksPass: 5,
      checksFail: 0,
      checksPending: 0,
      threadsTotal: 0,
      mergeable: "CONFLICTING",
    },
  }),
  row("repoPRs", "them", {
    kind: "pr",
    number: 220,
    title: "Draft: stream large exports",
    repo: "acme/api-gateway",
    url: "https://github.com/acme/api-gateway/pull/220",
    health: "draft",
    author: "robin-dev",
    age: "2d",
    ts: at(52),
    unresolved: 0,
    conversation: 0,
    labels: ["backend"],
    additions: 310,
    deletions: 40,
    changedFiles: 11,
  }),
  row("recentlyDone", "them", {
    kind: "pr",
    number: 205,
    title: "Fix off-by-one in pagination cursor",
    repo: "acme/api-gateway",
    url: "https://github.com/acme/api-gateway/pull/205",
    health: "merged",
    author: "alex-dev",
    age: "3d",
    activityAge: "1d",
    ts: at(80),
    unresolved: 0,
    conversation: 6,
    labels: ["backend"],
    additions: 12,
    deletions: 4,
    changedFiles: 1,
  }),
  row("recentlyDone", "them", {
    kind: "issue",
    number: 335,
    title: "Docs list a removed flag",
    repo: "acme/api-gateway",
    url: "https://github.com/acme/api-gateway/issues/335",
    health: "closed",
    author: "jo-dev",
    age: "4d",
    activityAge: "2d",
    ts: at(110),
    unresolved: 0,
    conversation: 3,
    labels: ["docs"],
  }),
]

/* The board a demo session sees: every source answered, none failed. */
export const demoInbox = (): Inbox => ({
  rows: demoRows,
  login: "alex-dev",
  fetchedAt: Date.now(),
  failed: [],
  reasons: [],
})

/* What the label picker offers in demo — the names the fixtures carry. */
export const demoLabels = [
  { name: "backend", color: "0366d6" },
  { name: "frontend", color: "0e8a16" },
  { name: "bug", color: "d73a4a" },
  { name: "a11y", color: "7057ff" },
  { name: "docs", color: "0075ca" },
  { name: "perf", color: "fbca04" },
  { name: "security", color: "b60205" },
  { name: "flaky", color: "e99695" },
  { name: "needs-tests", color: "d876e3" },
  { name: "good first issue", color: "7057ff" },
]

const stateOf = (found: Row): string =>
  found.health === "merged"
    ? "MERGED"
    : found.health === "closed"
      ? "CLOSED"
      : "OPEN"

/*
 * The detail panel's answer for a demo row, shaped like `/api/row`'s own.
 * Undefined when the row is not on the board, which the route reports as
 * missing rather than inventing a stranger.
 */
export const demoRowDetail = (repo: string, number: number) => {
  const found = demoRows.find(
    (candidate) => candidate.repo === repo && candidate.number === number,
  )
  if (!found) return undefined

  const failed = found.health === "ci-fail"
  return {
    kind: found.kind,
    number: found.number,
    title: found.title,
    url: found.url,
    state: stateOf(found),
    isDraft: found.health === "draft",
    mergeable: found.health === "conflict" ? "CONFLICTING" : null,
    reviewDecision:
      found.health === "approved"
        ? "APPROVED"
        : found.health === "changes-req"
          ? "CHANGES_REQUESTED"
          : null,
    author: found.author,
    createdAt: new Date(found.ts).toISOString(),
    body: `Sample data for the demo board — the real ${found.kind} lives on GitHub, this one lives in \`lib/demo-fixtures.ts\`.`,
    labels: [...(found.labels ?? [])],
    unresolved: found.unresolved,
    checks: failed
      ? [
          { name: "build", state: "FAILURE", url: null },
          { name: "lint", state: "SUCCESS", url: null },
        ]
      : found.health === "pending"
        ? [{ name: "build", state: "IN_PROGRESS", url: null }]
        : found.kind === "pr"
          ? [{ name: "build", state: "SUCCESS", url: null }]
          : [],
    reviews:
      found.health === "approved"
        ? [{ login: "alex-dev", state: "APPROVED" }]
        : found.health === "changes-req"
          ? [{ login: "priya-dev", state: "CHANGES_REQUESTED" }]
          : [],
    comments: [],
    budget: null,
  }
}
