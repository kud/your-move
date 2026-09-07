# Changelog

All notable changes to this project are documented here.

---

## 1.2.0 — 2026-09-07

### Highlights

- **Filter by the whole organisation, not a snapshot of its repos.** A new `owners` facet ORs with the existing repo picker, so ticking "acme" covers whatever it holds today and whatever it gains tomorrow — no more re-picking after a repo gets added. Saved views made before this aren't migrated, so re-save any that should use it. ([0421a58](https://github.com/kud/your-move/commit/0421a582c9c78a876aae1429c416b4c7f1c687c0))
- **Columns collapse to a rail.** Click a column header to fold it down to a 52px strip showing its mark and count; the fold state persists per device (`ym:cols`), so a folded column stays folded next time. ([d828245](https://github.com/kud/your-move/commit/d828245e1fc0faa1f882d4251e00b9fb95dce26b), timing tuned in [5204f94](https://github.com/kud/your-move/commit/5204f949d4a50798e4b3d96b683ce6c77b9519d4))
- **The board can finally use a wide screen.** Its width cap now comes from the schema itself — lane plus one column per status, 2250px — instead of a flat 1600px, so a big display shows the whole board rather than scrolling inside its own dead margin. ([3fcc7ef](https://github.com/kud/your-move/commit/3fcc7efc386ecfd06fbb27c6ebed452b689581e6))
- **A theme switch on the login page**, top right, auto/light/dark with hand-drawn glyphs — the logic now lives in one place (`lib/theme.ts`), shared with the menu. ([495be97](https://github.com/kud/your-move/commit/495be97f4939054ca5a38e4b8fe9daaaec2e691c), [6ca07d1](https://github.com/kud/your-move/commit/6ca07d10528b1e089ac027dfef20b11161019152))
- **The loading shell now looks like the board it's about to become** — group band, seven column headers, seams and footer drawn up front, with only the cells left to shimmer, instead of one grey rectangle. ([a922e5f](https://github.com/kud/your-move/commit/a922e5f678e6323bde11f9ddc00efb4af8ec0e1c), density tuned in [36ea106](https://github.com/kud/your-move/commit/36ea10651ee9832ccf4a8751f688968cd709dbbd))
- **A GitHub mark** on the sign-in button and on the detail panel's "Open on GitHub" button. ([e7ffbdc](https://github.com/kud/your-move/commit/e7ffbdcf7fb2b428521ba21703f4d26f521ba167), [6ca07d1](https://github.com/kud/your-move/commit/6ca07d10528b1e089ac027dfef20b11161019152))
- **The app now tells you when it's stale.** An installed PWA can sit on an old build for days without ever refetching its document; a build stamp baked in at compile time is compared against what's actually deployed, and a persistent "update available" control shows up the moment they disagree — pressed, it clears every cache and reloads clean. ([5fa57c7](https://github.com/kud/your-move/commit/5fa57c778d39e23152fb71afc05f3cbc87e88074))
- **⌘K jumps to the repository search** inside the filter sheet — not a command palette, just the shortest route to a control that already existed. ([3bd4a76](https://github.com/kud/your-move/commit/3bd4a76379f6f25e637d93fa65155970813f42d5))

### Fixes

- The menu and filter popovers carried a Tailwind `flex` utility that outranked the browser's own rule for hiding a closed popover, so a closed menu stayed laid out and invisible — swallowing clicks meant for whatever sat underneath, including the Clear button, and sometimes firing a GitHub navigation instead. ([391933a](https://github.com/kud/your-move/commit/391933a060ef76a56ba29fee7e436a200428298c))
- Cards with a long unbreakable token (a service name, say) overflowed their column and painted over the one next to it — wrapping alone wasn't enough, the cell also needed permission to shrink below its content's natural width. ([90bd4d6](https://github.com/kud/your-move/commit/90bd4d6c454759508dbb18ac8488b3921b7d9628), [06cac6c](https://github.com/kud/your-move/commit/06cac6cd19222b5741b9d5d434ee9c922d2cb7a2))
- The filter banner used to list every picked repository by name; it now summarises per dimension ("15 repos", "all of acme"), leading with the hidden count rather than burying it in a wall of names. ([0421a58](https://github.com/kud/your-move/commit/0421a582c9c78a876aae1429c416b4c7f1c687c0))
- Failed data sources were reported by their internal query id (`myPRs`, `reviewRequests`) instead of the names shown on the board. ([21ee7d5](https://github.com/kud/your-move/commit/21ee7d56265840afeedf4f7635ccce2649b7152f))
- Relative ages read as `2M AGO` under the header's uppercase styling — indistinguishable from months when it meant minutes. Now spelled `min`/`hr` so the unit survives the transform. ([3fcc7ef](https://github.com/kud/your-move/commit/3fcc7efc386ecfd06fbb27c6ebed452b689581e6))
- The board's right edge, and the empty scroll runway past it, now read as a deliberate ending rather than an unfilled board. ([46bb24c](https://github.com/kud/your-move/commit/46bb24ce29909981754e3152396635d27a0b5d16))
- A lane kept its hover tint while its own detail panel was open, and while the pointer sat over the repo name — which opens something else entirely. ([c32cd75](https://github.com/kud/your-move/commit/c32cd751ad6d8e3c64f30df8f66c0d2c94ca7ad8), [3fcc7ef](https://github.com/kud/your-move/commit/3fcc7efc386ecfd06fbb27c6ebed452b689581e6))
- Placeholder cards rendered more solidly for anyone with reduced motion turned on, because `.shimmer` only set its opacity inside the keyframes that reduced motion skips. ([a9d6b9a](https://github.com/kud/your-move/commit/a9d6b9ac0c964e3a3888376577007ccc6170633f), [8e7bb53](https://github.com/kud/your-move/commit/8e7bb53aef8b032238948bee603c28312c6a7a96))
- Card titles and the "+N more" button lost their layout once wrapped inside the new column-fold container. ([81d04a3](https://github.com/kud/your-move/commit/81d04a3162476ecf11ec9ea1468fa7aab14e3eec), [77c72ef](https://github.com/kud/your-move/commit/77c72ef5cadda33353fb76cab3a14039b29ae514))
- The labels row on a card sat over the clickable card area, blocking taps in the gaps beside the chips. ([1c04771](https://github.com/kud/your-move/commit/1c047719ec7d93b93a9d3d23121c2b4e05c22ea6))
- Comments in the detail panel now render as markdown, and stray HTML comment markers are stripped rather than shown. ([c39e4ca](https://github.com/kud/your-move/commit/c39e4ca66f9d4236b4e886af4b6bc25847ae8856))
- Opening a row on a phone now arrives as a modal, not a full screen — it keeps a sliver of the blurred board visible at every edge, so there's an obvious way back. A related bug sent the board sliding sideways whenever a closed panel returned focus to its card. ([d085407](https://github.com/kud/your-move/commit/d085407c4c256e3aea34893f0fced76791014727))
- Tapping a filter chip on the phone's status rail could animate partway and snap straight back — the browser re-snaps mid-scroll, and the nearest snap point is the column you started on, so it read as a dead button. Snapping now stands aside for the length of the move. ([306e782](https://github.com/kud/your-move/commit/306e782cad5712d8df44228f58ec2e964cc71492))
- The detail panel is now a real keyboard dialog, not just one labelled as one: focus moves into it on open, Tab is contained inside it, and closing it returns focus to the card that opened it — instead of leaving a keyboard or screen-reader user tabbing through the board underneath. ([bedb313](https://github.com/kud/your-move/commit/bedb31348f9def12a904e701eba599d2ed7c1b9c))
- Card hover styles no longer stick after a tap on a touch device. ([1874ba1](https://github.com/kud/your-move/commit/1874ba1a3f2c2bf3a6d6ce99bf91904d47106807))

<details>
<summary>Internal (6 commits)</summary>

- Extracted the loading skeleton grid to CSS with a regression test pinning the board to seven columns, simplified the column-fold button's transition, added a hover affordance to the inbox refresh button, made filter chips toggle to deselect, and added (then tuned) a per-cell fade-in animation for when the board first settles.

</details>

---

## 1.1.0 — 2026-09-07

### Highlights

- **Rows open in the app on the phone too** — a reversal of the earlier "hand it to the GitHub app" call. The panel still does none of the work — no diff, no thread, no comment box — but it does show the verdict, which GitHub states nowhere, and a verdict is worth most on a phone, in a queue. Triaging four rows now costs zero app switches instead of four: full screen, the board blurred out behind it, "Open on GitHub" full width and thumb height. ([34a80bb](https://github.com/kud/your-move/commit/34a80bb7f681caa8c2e16f57c7d193d0b733cea6))
- **A setting for where a row opens** — side panel, modal, full screen, or straight to GitHub, all as one choice with two faces: two options on a phone, four on a desk, because the panel shapes are indistinguishable at 390px anyway. ([369549a](https://github.com/kud/your-move/commit/369549a8eb759f67d79055a2b84556da82e88642))
- **Lanes can be sorted by name as well as by urgency** — urgency stays the default, since surfacing what wants you is the app's whole premise; name is for arriving in search of one project rather than reading down what's in front of you. ([22c5150](https://github.com/kud/your-move/commit/22c51503e498974405d861215ccdae6ede38fdb0))
- **Saved views can be shared as a link, not just a file** — the payload rides in the URL fragment, which never reaches a server, since these carry repository names and some are private. Merges by name on arrival, then strips itself out of the address bar. ([78f369e](https://github.com/kud/your-move/commit/78f369eede2eed5e054387bdfae76f253ad4579f))
- **A fortnight window for recently done work**, sitting between the existing week and month. ([bd4a077](https://github.com/kud/your-move/commit/bd4a0772bca0daf21b699c0e104fc55fa2fa9e0a))
- **The board's position survives a restart**, not just a trip out to GitHub. Columns restore always, since they're fixed furniture; the lane scroll offset only within the hour, since lanes reorder as work moves and a stale offset would point at a row that's no longer there. ([806c91a](https://github.com/kud/your-move/commit/806c91adfaf8887a562c98c99f0622658793c1a7))
- **Owner avatars in the repository filter and on group headers** — and every facet's rows now carry the mark of what they are, so a repo's book, a label's tag, and a status's tone dot read as one family. ([c84102e](https://github.com/kud/your-move/commit/c84102eaf7f4d55fb91d4876cdb97290047a646c))

### Fixes

- The row panel wasn't actually full screen on a phone — its shape classes weren't width-prefixed, so a "side panel" kept its 92vw and the board showed down the right edge. Also fixed in the same pass: the settings label read "Open rows" and now reads "Open tickets" — `Row` is what the code calls them because they're issues and pull requests both, and that piece of plumbing had leaked into the interface. ([6436d13](https://github.com/kud/your-move/commit/6436d13bbe07740dbf4fd3d44d48e11ddcfd3b1b))
- That fix then broke the desktop modal and full-screen views — two Tailwind utilities of equal specificity resolve by their order in the generated stylesheet, not by their order in the class string, so a base reset silently beat both and the modal collapsed. ([225b408](https://github.com/kud/your-move/commit/225b408a496b3302eea575d52c2fc0627068c8f6))

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
