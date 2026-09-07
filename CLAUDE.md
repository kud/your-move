@AGENTS.md

# Your Move

A GitHub inbox, installable as a PWA on any device, answering one question: **what moved, and is it my turn?**

The full design rationale is [issue #1](https://github.com/kud/your-move/issues/1). What follows is only the part that must hold in every future change.

## The constraints

These are load-bearing. Breaking one is a decision to make deliberately and write down, never a thing to do in passing.

- **GitHub is the source of truth.** Issues, PRs, reviews, checks, labels and history live there and nowhere else.
- **Never mirror.** No second issue database to power the UI. The test for whether a store is honest is what happens when it is empty: a mirror is then _wrong_, invisibly; a cache is merely _slow_. Caching query results is fine. Anything that would live only in our store — a column position, a per-user ordering — is not.
- **Derive from GitHub facts plus conventions.** A status is computed, not recorded.
- **Say how old the answer is.** A cache that says "as of two minutes ago" is honest in a way a mirror structurally cannot be, because the mirror believes itself.
- **Direct repository entry must always work.** Point it at anything, with no setup, no installation step and no backfill.
- **Host-specific opinions stay configurable**, out of `@kud/gh` and `@kud/gh-workflow`.

## Where the logic lives

Very little belongs here. `@kud/gh` builds the GraphQL and derives health; `@kud/gh-workflow` owns `whoseMove`, sorting and the node→row mapping. Both are pure and published, and both are shared with the terminal surface.

**Before adding workflow logic to this repo, check whether it belongs in `@kud/gh-workflow` instead.** If the TUI would want it too, it does. What legitimately lives here is transport, session, and presentation.

`@kud/gh-cockpit` is the sibling terminal surface. Two postures, one library — not one product with two skins, and neither should grow a dependency on the other.

That rule is about **code and dependencies**, and it was once read as forbidding shared idioms too: ⌘K opened the filter search here specifically so this surface would not acquire cockpit's palette. That reading is retired. ⌘K on github.com is itself a command palette, so a GitHub inbox matching it is being consistent with the host it reads from rather than importing the TUI's posture. ⌘K opens the launcher; `/` opens the filter search, exactly as GitHub divides them. The line that keeps them distinct is not which shortcut exists but what each one does: **the launcher never filters** — it searches row titles and arrives at one thing, where the sheet searches facet names and narrows the set.

## Interface

One responsive view, not two products.

A column is a device for peripheral vision: its worth is seeing the third column while your hand is in the first. Wide viewports get that; a 390pt screen does not, so there the same board becomes a grouped list with counts in the section headers.

- Ordering defaults to **what changed**. If a ranking is applied, the reason must be legible on the row.
- A `their move` row never ranks above a `your move` one.
- Every row carries a short **kind** label, or the list flattens into undifferentiated titles.
- Single-column-with-snapping is rejected on purpose: it keeps the horizontal axis and then hides the counts behind a gesture.
- Never let colour be the only thing separating two states — give each a glyph or a word too.

## Auth

An **OAuth App**, not a GitHub App: a GitHub App's user access token is intersected with the App's installations, which is the wrong shape for a repo scope that changes weekly.

The user's token is sealed with AES-GCM under `SESSION_SECRET` and kept in an `HttpOnly` cookie. **There is no session store, and adding one needs a real trigger** — a background job that must act with no request in flight. "It would be tidier" is not one.

## Known limits

**Labels are repo-scoped.** Derived columns that need no label — `your move`, `their move`, CI red, review requested — work everywhere. Label-columns only work where you own the repo, because you cannot create a label on someone else's.
