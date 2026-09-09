import { writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import { Markdown, safeHref } from "./markdown.js"

/*
 * Properties over generated bodies, rather than examples.
 *
 * The renderer's one fatal defect is non-termination — two patterns disagreeing
 * about a line that neither of them then consumes — and it has no wrong value
 * to assert against: the worker simply dies. So every generated case is written
 * to a breadcrumb file before it is rendered. If a run ends in an out-of-memory
 * kill rather than a report, that file holds the input that did it.
 *
 * Every invisible character is written as an escape, never as itself. They are
 * the whole subject here, and a fixture nobody can read is worse than none —
 * two of them are line terminators in JS SOURCE as well as in the data, so a
 * raw copy breaks the very tools you would reach for to go looking, and several
 * editors and pipes drop them silently on the way in.
 */
const BREADCRUMB = join(tmpdir(), "your-move-markdown-fuzz-last.json")

/* Seeded, so any failure is reproducible from its seed alone. */
const rng = (seed: number) => () => {
  seed = (seed * 1664525 + 1013904223) >>> 0
  return seed / 0x100000000
}

/*
 * U+2028 and U+2029 are why this list exists. A dot cannot cross either and an
 * end-of-input anchor will not pass them, so an anchored branch can reject a
 * line that a bare prefix guard accepted — the exact shape of the crash that
 * CRLF caused. The rest is the ordinary rubbish a pasted body carries.
 */
const CONTROL = [
  "\u0000",
  "\u0001",
  "\u0008",
  "\u000B",
  "\u000C",
  "\u001B",
  "\u007F",
  "\u00A0",
  "\u200B",
  "\u2028",
  "\u2029",
  "\uFEFF",
]

const WORDS = ["alpha", "beta", "gamma", "**bold", "`code", "a*b*c", "~~x", "]("]

const HREFS = [
  "https://example.com",
  "http://example.com/a(b",
  "javascript:alert(1)",
  "JaVaScRiPt:alert(1)",
  " javascript:alert(1)",
  "java\tscript:alert(1)",
  "&#106;avascript:alert(1)",
  "data:text/html;base64,PHNjcmlwdD4=",
  "vbscript:msgbox",
  "ｈｔｔｐｓ://example.com",
  "//evil.example",
  "/relative",
  "https:/example.com",
  "\u0000javascript:alert(1)",
]

const pick = <T,>(r: () => number, xs: readonly T[]) =>
  xs[Math.floor(r() * xs.length)]

const text = (r: () => number) => {
  let out = ""
  const n = Math.floor(r() * 5)
  for (let k = 0; k <= n; k++) {
    out += pick(r, WORDS)
    if (r() < 0.25) out += pick(r, CONTROL)
    out += " "
  }
  return out
}

const makers: Array<(r: () => number) => string> = [
  /* Headings, including seven hashes, no space, and trailing whitespace. */
  (r) =>
    "#".repeat(1 + Math.floor(r() * 8)) +
    " ".repeat(Math.floor(r() * 3)) +
    text(r) +
    (r() < 0.5 ? "   " : ""),
  /* Unordered items, ragged indent, sometimes no space after the marker. */
  (r) =>
    " ".repeat(Math.floor(r() * 6)) +
    pick(r, ["-", "*", "+"]) +
    (r() < 0.8 ? " ".repeat(1 + Math.floor(r() * 3)) : "") +
    text(r),
  /* Ordered items, both delimiters. */
  (r) =>
    " ".repeat(Math.floor(r() * 6)) +
    String(Math.floor(r() * 1000)) +
    pick(r, [".", ")"]) +
    (r() < 0.8 ? " " : "") +
    text(r),
  /* Task items, including a marker that is not a task marker. */
  (r) => "- [" + pick(r, [" ", "x", "X", "y", ""]) + "] " + text(r),
  /* Fences, opened far more often than closed. */
  (r) => " ".repeat(Math.floor(r() * 4)) + "```" + (r() < 0.5 ? "sql" : ""),
  /* Quotes, nested and bare. */
  (r) => pick(r, [">", "> ", ">>", "   > ", ">>>"]) + text(r),
  /* Rules, and near-misses for one. */
  (r) => pick(r, ["---", "***", "___", "- - -", "--", "*-*"]),
  /* Table rows, separators, and rows with no separator above them. */
  (r) =>
    pick(r, [
      "| a | b |",
      "|---|---|",
      "| :-- | --: |",
      "a | b",
      "|",
      "| a |",
      "---|---",
    ]),
  /* Inline marker soup, with every href shape the allowlist has to refuse. */
  (r) =>
    text(r) +
    "[" +
    text(r) +
    "](" +
    pick(r, HREFS) +
    ") ![shot](" +
    pick(r, HREFS) +
    ") " +
    pick(r, HREFS),
  /* Bare HTML, which the renderer strips rather than renders. */
  (r) =>
    pick(r, [
      "<details>",
      "</summary>",
      '<img src=x onerror="alert(1)">',
      "<br>",
      "<kbd>a</kbd>",
      "<script>alert(1)</script>",
      "a `<div>` b",
    ]),
  /* Empty and whitespace-only. */
  (r) => pick(r, ["", " ", "\t", "    ", "\u00A0", "\u200B"]),
  /* One very long line. */
  (r) => pick(r, ["x", "**a", "- "]).repeat(2000 + Math.floor(r() * 2000)),
  /* Control characters alone on a line. */
  (r) => pick(r, CONTROL).repeat(1 + Math.floor(r() * 3)),
  /* An HTML comment, opened and sometimes never closed. */
  (r) => (r() < 0.5 ? "<!-- note" : "<!-- note -->") + text(r),
]

const body = (r: () => number) => {
  const n = Math.floor(r() * 24)
  const lines: string[] = []
  for (let k = 0; k <= n; k++) lines.push(pick(r, makers)(r))

  /* Mixed line endings inside one body, which is how the live crash arrived. */
  let out = ""
  lines.forEach((line, k) => {
    if (k) out += pick(r, ["\n", "\r\n", "\r", "\n"])
    out += line
  })
  return out
}

type Node = {
  type?: unknown
  props?: { href?: unknown; children?: unknown }
}

const walk = (node: unknown, visit: (el: Node) => void) => {
  if (Array.isArray(node)) return node.forEach((one) => walk(one, visit))
  if (!node || typeof node !== "object") return
  const el = node as Node
  visit(el)
  walk(el.props?.children, visit)
}

const render = (source: string) => {
  writeFileSync(BREADCRUMB, JSON.stringify({ source }))
  return (Markdown({ source }) as { props: { children: unknown[] } }).props
    .children
}

const CASES = Number(process.env.MARKDOWN_FUZZ_CASES ?? 4000)

/*
 * Failure messages are built only on failure. Handing a serialised body to
 * `expect` as its message serialises every generated case on every pass, which
 * is most of the run time and none of the coverage.
 */
const fail = (source: string, why: string): never => {
  throw new Error(`${why}\n\nsource: ${JSON.stringify(source)}`)
}

describe("the renderer, over generated bodies", () => {
  it("terminates and never throws", { timeout: 300_000 }, () => {
    const r = rng(20260909)
    for (let n = 0; n < CASES; n++) {
      const source = body(r)
      try {
        render(source)
      } catch (error) {
        fail(source, `threw: ${String(error)}`)
      }
    }
    expect(true).toBe(true)
  })

  /*
   * Output bounded by input. A parser that stops consuming lines appends one
   * empty block per spin, so an unbounded block count is the same defect as a
   * hang, caught one step before the tab dies.
   */
  it(
    "emits no more blocks than the body has lines",
    { timeout: 300_000 },
    () => {
      const r = rng(994113)
      for (let n = 0; n < CASES; n++) {
        const source = body(r)
        /* Every terminator the renderer may split on, so the denominator is a
           superset rather than a copy of its own normalisation. */
        const lines = source.split(/\r\n?|\n|[\u2028\u2029]/).length
        const blocks = render(source).length
        if (blocks > lines + 2)
          fail(source, `${blocks} blocks from ${lines} lines`)
      }
      expect(true).toBe(true)
    },
  )

  /*
   * The end-to-end form of the one property whose failure is not cosmetic: no
   * anchor anywhere in the tree may carry a scheme that can execute. Stronger
   * than testing `safeHref` directly, because it also covers the paths that
   * build an anchor without asking it.
   */
  it(
    "never emits an anchor outside http and https",
    { timeout: 300_000 },
    () => {
      const r = rng(77213)
      for (let n = 0; n < CASES; n++) {
        const source = body(r)
        walk(render(source), (el) => {
          if (el.type !== "a") return
          const href = String(el.props?.href)
          if (!/^https?:\/\//i.test(href)) fail(source, `anchor href ${href}`)
        })
      }
      expect(true).toBe(true)
    },
  )
})

describe("safeHref, over obfuscated schemes", () => {
  const DANGEROUS = ["javascript", "data", "vbscript", "file", "blob"]

  const obfuscations = (scheme: string) => [
    scheme,
    scheme.toUpperCase(),
    [...scheme].map((c, n) => (n % 2 ? c.toUpperCase() : c)).join(""),
    ` ${scheme}`,
    `\t${scheme}`,
    `\n${scheme}`,
    `\u0000${scheme}`,
    `\u00A0${scheme}`,
    `\u200B${scheme}`,
    `\uFEFF${scheme}`,
    scheme.replace("a", "&#97;"),
    scheme.replace("a", "%61"),
    [...scheme].join("\u200B"),
    /* Cyrillic a and Greek o, which look like their Latin neighbours. */
    scheme.replace(/a/g, "а"),
    scheme.replace(/o/g, "ο"),
    `${scheme}\t`,
  ]

  it("refuses every obfuscation of an executable scheme", () => {
    for (const scheme of DANGEROUS)
      for (const form of obfuscations(scheme))
        for (const href of [`${form}:x`, `${form}:alert(1)`, `${form}://x`])
          expect(safeHref(href), href).toBe(false)
  })

  it("still allows the two schemes it exists to allow", () => {
    for (const href of [
      "http://x",
      "https://x",
      "HTTPS://x",
      "hTtPs://x/a?b=c#d",
    ])
      expect(safeHref(href), href).toBe(true)
  })
})
