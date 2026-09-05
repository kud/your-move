<div align="center">

📥

# Your Move

![Next.js](https://img.shields.io/badge/Next.js-000000?style=flat-square&logo=next.js&logoColor=white)
![React](https://img.shields.io/badge/React-149ECA?style=flat-square&logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)
![MIT](https://img.shields.io/badge/licence-MIT-22C55E?style=flat-square)

**A GitHub inbox for what moved and whose move it is — installable on any device.**

[Features](#-features) • [How it works](#-derive-never-mirror) • [Self-hosting](#-self-hosting) • [Development](#-development)

</div>

Your Move is a single authenticated page that answers one question: **what changed, and is it my turn?** It reads GitHub live — pull requests, reviews, checks, issues — and turns that into a list grouped `your move` / `their move`, ordered by what changed most recently. Tap a row and it opens on GitHub. There is nothing else to configure.

It is built to be genuinely good on a phone, since that is the hardest case and the one that usually goes unserved. Desktop and tablet are first-class too — one responsive surface, installable everywhere as a PWA.

## 🌟 Features

- **📱 One surface, two shapes** — the same board renders as columns on a wide viewport and as a grouped list with section counts on a narrow one. Not a mobile app and a desktop app: one view, two widths.
- **🔀 Whose move, at a glance** — rows are grouped `your move` / `their move` and ordered by what changed, each carrying a short reason: review requested, CI failing, changes requested, a conflict.
- **🔗 Opens where the truth lives** — tapping or clicking a row takes you straight to the issue or PR on GitHub. No parallel comment thread, no second place to check.
- **🔑 GitHub OAuth, per user** — sign in with GitHub and every request runs under your own token, scoped to whatever you can already see. No shared token, no passphrase.
- **🕰 Honest about its own age** — the board polls rather than mirrors, and says visibly how old what you're looking at is: live, refreshing, stale, or offline.
- **📲 Installable everywhere** — a proper PWA with a manifest, a service worker, and an offline page, so it behaves like an app on the home screen rather than a bookmarked tab.

## 🔀 Derive, never mirror

GitHub owns issues, PRs, reviews, checks, labels and history. Your Move owns only the interpretation — whose move it is, how rows are ranked, how they're presented — and it derives that fresh, on every load. There is no database, no mirror, and no webhooks.

The test for whether a store is honest is what happens when it's empty:

|            | Cold store                                                  |
| ---------- | ----------------------------------------------------------- |
| **Mirror** | The row isn't there, so the feature is wrong — invisibly so |
| **Cache**  | The row isn't there, so you fetch it — slow, never wrong    |

So the app caches query _results_, shows staleness visibly rather than hiding it, and never lets anything live only in memory. It polls GitHub every 60 seconds and marks the board stale after 5 minutes of silence, rather than quietly serving an answer that might no longer be true.

The data path is short by design: `@kud/gh` builds the GraphQL queries and merges the results; `@kud/gh-workflow` decides what a row is and whose move it is. Neither library knows this is a browser — the transport and the section vocabulary belong entirely to this app.

## 🚀 Quick Start

```sh
git clone https://github.com/kud/your-move.git
cd your-move
npm install
cp .env.example .env.local
```

Fill in `.env.local` (see [Self-hosting](#-self-hosting) below for what each variable needs), then:

```console
$ npm run dev
▲ Next.js 16.3.1
- Local:        http://localhost:3000

✓ Ready in 890ms
```

Open `http://localhost:3000`, sign in with GitHub, and the board loads.

## 🔐 Self-hosting

Your Move has no server-side session store — the session _is_ your GitHub token, encrypted with AES-GCM under a server-only key and kept in an `HttpOnly` cookie. Nothing to run, nothing to back up, and no extra component that can be down while GitHub is up.

Three environment variables, all required:

| Variable               | What it is                                                                                                                                                                                                |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SESSION_SECRET`       | Any long random string — the key the session cookie is sealed under. Generate one with `openssl rand -base64 48`. Changing it signs everyone out, which doubles as a way to revoke every session at once. |
| `GITHUB_CLIENT_ID`     | From a [GitHub OAuth App](https://github.com/settings/developers).                                                                                                                                        |
| `GITHUB_CLIENT_SECRET` | From the same OAuth App.                                                                                                                                                                                  |

When creating the OAuth App, set its **Authorization callback URL** to `<your-deployment>/api/auth/callback`.

Deliberately an **OAuth App**, not a GitHub App: a GitHub App's user access token is intersected with the App's installations, so it only ever sees repos the App happens to be installed on — the wrong shape for a scope that changes weekly. An OAuth App carries no such restriction.

The reference deployment runs at `move.kud.io`. To run your own:

```sh
npm run build
npm start
```

Deploy the build output anywhere that runs Node — a platform like Vercel works with zero extra configuration beyond the three environment variables above.

## 🔧 Development

```
your-move/
├── app/                  Routes: the board, login, OAuth callback, inbox API
│   ├── api/auth/         OAuth login, callback, logout
│   ├── api/inbox/        The one endpoint the board polls
│   ├── login/            Static sign-in page — no client JS
│   └── offline/          Precached page shown with no network
├── components/           Board/list UI, hooks for polling, notifications, view mode
├── lib/                  Auth (session sealing), GitHub data path, time/section helpers
├── public/               Manifest icons, service worker
└── assets/               Source SVGs the icons are rendered from
```

| Script              | What it does                |
| ------------------- | --------------------------- |
| `npm run dev`       | Start the dev server        |
| `npm run build`     | Production build            |
| `npm start`         | Run the production build    |
| `npm test`          | Run the test suite (Vitest) |
| `npm run typecheck` | Type-check with no emit     |

## 🖥 Its sibling

[`@kud/gh-cockpit`](https://github.com/kud/gh) is the terminal counterpart — a keyboard-first TUI with cross-repo aggregation, filters and drill-in, in daily use. Your Move is the graphical surface, built for any device rather than a keyboard. They're two products with different postures, reading the same GitHub facts through the same underlying libraries (`@kud/gh`, `@kud/gh-workflow`) — not one product wearing two skins.

## 🏗 Tech Stack

| Layer     | Choice                                                                                                  |
| --------- | ------------------------------------------------------------------------------------------------------- |
| Framework | Next.js 16 (App Router)                                                                                 |
| UI        | React 19                                                                                                |
| Styling   | Tailwind CSS 4                                                                                          |
| Language  | TypeScript                                                                                              |
| Data      | `@kud/gh` (GraphQL query building, health derivation), `@kud/gh-workflow` (whose-move verdict, sorting) |
| Markdown  | `react-markdown` + `remark-gfm`                                                                         |
| Testing   | Vitest                                                                                                  |

---

MIT © [kud](https://github.com/kud) — Made with ❤️
