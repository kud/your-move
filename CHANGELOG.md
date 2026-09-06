# Changelog

All notable changes to this project are documented here.

---

## 1.0.0 — 2026-09-06

First release of **your-move**: a single-user GitHub board PWA that answers one question — whose move is it. It reads GitHub live over GraphQL, with no database, no mirror and no webhooks, and lays every tracked repository out as a matrix: one row per repo, one column per status, so a project's whole situation is a line you read across. It's free to run and a full board read costs about 74 of GitHub's 5,000 hourly GraphQL points. ([939fb84](https://github.com/kud/your-move/commit/939fb84166330dfa2397200677d7c618aaed5380))

### Highlights

- **The board** — repos as lanes, seven status columns split across two lifecycles (yours to act on, theirs) plus Closed, shown as swimlanes on desktop and a scroll-snapping single column with a status rail on the phone. Lanes fold to a hatched summary that still shows which columns are holding something, lane names and column headers stay sticky as you scroll, and the board remembers your scroll position across a trip out to GitHub and back. ([c5bf40e](https://github.com/kud/your-move/commit/c5bf40e313babdd014f1f6206cafa5ec590a4317), [0f1896a](https://github.com/kud/your-move/commit/0f1896ae3792fcfe785731b9f16d2f23affbed7a), [b144dd2](https://github.com/kud/your-move/commit/b144dd245ce11dcbe465de3b2e12face0ca6e90c), [4c993ba](https://github.com/kud/your-move/commit/4c993ba10ba6a273639e362cbe47391b3a44f76c), [fa20672](https://github.com/kud/your-move/commit/fa2067264be6e001811c2bb621ed91fcac4cdf9c))
- **Deciding, not working** — tap a row to open a detail panel with the verdict, checks, reviews, and the description rendered as restricted markdown (tables and hand-wrapped line breaks render, stray HTML comments don't). Opens as a side panel, a modal, or full screen, whichever suits what you're looking at — deliberately no diff and no comment box, because the work itself stays on GitHub. ([41a927c](https://github.com/kud/your-move/commit/41a927c8c09ae6a1faaf43f04d6baeeb288079fe), [b44b87a](https://github.com/kud/your-move/commit/b44b87a5681589e2d205455c48d82cf8a8a77f3c), [e405bd5](https://github.com/kud/your-move/commit/e405bd5806e1bf276faead24a1e4d29f1a2b692a), [1b82baf](https://github.com/kud/your-move/commit/1b82bafc76d2bac586d66a61751cbcc289d63645))
- **Filters** — narrow by whose move it is, repository, status, or label, combining AND across facets and OR within one, with the selection carried in the URL. Save a combination as a named view, export the set as JSON, and import it on another device. ([69cb61d](https://github.com/kud/your-move/commit/69cb61db863212e30df9714a694906da97e616dd), [a01ab95](https://github.com/kud/your-move/commit/a01ab957b63350c94448641b5213491e50b2d4b2))
- **Honest about its own age** — every read is live, cached for five minutes, and polled every ten minutes only while you're actually looking at the board. Staleness is visible rather than hidden, and if a source fails, the board says so instead of quietly showing you less than it found. ([7ca52e7](https://github.com/kud/your-move/commit/7ca52e7fcf2db5a4aab15c799eb784c51d8967d5), [c3d94e4](https://github.com/kud/your-move/commit/c3d94e4071b772ec0511a6b68321d83e6093d50b), [4e2dcb6](https://github.com/kud/your-move/commit/4e2dcb64d4ad81ce9391fe632e2edb61c36987ce), [a1afd78](https://github.com/kud/your-move/commit/a1afd7817a8bacdc4b6034c0b224b034bfb7303e))
- **Installable** — a proper PWA: an offline page, a hand-written service worker, three themes (auto, light, dark), a higher-contrast mode, and full support for reduced motion. ([098a211](https://github.com/kud/your-move/commit/098a21150cecbe1dae9cf0d1d63e33aa8c6cc63b), [8ee41d3](https://github.com/kud/your-move/commit/8ee41d3ccefec0e1f5400ed93d87f54ff10d727c), [8442c69](https://github.com/kud/your-move/commit/8442c69c09de0b23bc62cca02c31ec9d5d2d20a7))
- **Labels** — the one thing it writes back to GitHub, and only offered where you actually have push access to the repository. ([19e1ae5](https://github.com/kud/your-move/commit/19e1ae5363194de1da9ff79b651999bb75b0de2e), [235b8fe](https://github.com/kud/your-move/commit/235b8fe27b88ed6e91519cb667685ee229cbdfa7))

<details>
<summary>Internal (66 commits)</summary>

- Extensive fixes to code that hadn't shipped yet — scroll-position bugs, focus rings, popover selection leaks, grid-line ownership, sky-gradient banding — including a sweep of defects found in a three-way design, security and accessibility audit before launch.
- The brand mark went through several concepts (two diamonds, a single circle, a ring motif) before landing on the folded-M handover mark that ships today.
- Performance tuning: polling cadence, re-render reduction, canvas throttling, tap-delay removal, and streaming the shell ahead of the board to shorten the installed splash.
- Layout refactors consolidating the swimlane/stack views, scroll-snap alignment, and column-width handling into their current shape.
- Housekeeping: dependency bumps, gitignore hygiene, a middleware runtime fix, and comment cleanup.

</details>

---
