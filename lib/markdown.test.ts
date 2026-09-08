import { describe, expect, it } from "vitest"

import { clamped, Markdown, safeHref } from "./markdown.js"

/*
 * The one property in the renderer whose failure is not cosmetic.
 *
 * Everything else it gets wrong shows up as ugly text. This shows up as a link
 * in a panel, on an issue opened by a stranger on a repo you do not own, that
 * runs something when it is clicked. Markdown link syntax accepts any scheme,
 * so the allowlist is the whole defence.
 */
describe("safeHref", () => {
  it("allows http and https, whatever their case", () => {
    expect(safeHref("https://github.com/kud/your-move")).toBe(true)
    expect(safeHref("http://example.com")).toBe(true)
    expect(safeHref("HTTPS://example.com")).toBe(true)
  })

  it("refuses every scheme that can execute or embed", () => {
    for (const href of [
      "javascript:alert(1)",
      "JaVaScRiPt:alert(1)",
      "data:text/html;base64,PHNjcmlwdD4=",
      "vbscript:msgbox",
      "file:///etc/passwd",
    ])
      expect(safeHref(href), href).toBe(false)
  })

  /*
   * A relative link is not dangerous, but it is not useful either: this panel
   * renders text written against github.com, so `/kud` there means GitHub's
   * root and not ours. Refused rather than resolved, so it renders as its own
   * label instead of pointing somewhere wrong.
   */
  it("refuses relative and protocol-relative links", () => {
    expect(safeHref("/kud/your-move")).toBe(false)
    expect(safeHref("//evil.example")).toBe(false)
    expect(safeHref("#anchor")).toBe(false)
  })
})

/*
 * The clamp, whose failure is the one a reader can see without knowing anything
 * about the code: a comment they can tell is short, wearing a fade that says
 * there is more of it.
 *
 * `null` is the load-bearing return. It is not "no truncation needed" as a
 * convenience — it is the signal that the panel must draw no cap and no mask at
 * all, so a test that only checked the truncated STRING would pass while the
 * short case still faded.
 */
describe("clamped", () => {
  it("leaves a short comment entirely alone", () => {
    expect(clamped("Looks good to me.")).toBe(null)
    expect(clamped("one\ntwo\nthree")).toBe(null)
    expect(clamped("")).toBe(null)
  })

  /* The boundary in both directions, because an off-by-one here is invisible:
     it caps a comment that fitted, or fails to cap one that did not. */
  it("clamps at the line boundary and not before it", () => {
    const six = Array.from({ length: 6 }, (_, i) => `line ${i + 1}`).join("\n")
    expect(clamped(six)).toBe(null)

    const seven = `${six}\nline 7`
    expect(clamped(seven)).toBe(six)
  })

  /*
   * The case a line count cannot see. One paragraph of 600 characters is a
   * single line, so a line-only clamp returns `null` and the panel renders the
   * lot — which is the shape a person writes, as against the many-short-lines
   * shape a bot writes.
   */
  it("clamps one long paragraph, which is a single line", () => {
    const paragraph = "word ".repeat(140).trim()
    expect(paragraph.split("\n")).toHaveLength(1)
    expect(clamped(paragraph)).not.toBe(null)
  })

  /* Never mid-line: a cut inside markdown source can leave an unclosed span or
     half a link, and a clamp that corrupts what it shows is worse than one that
     shows too much. */
  it("cuts only at a line boundary", () => {
    const body = `${"a".repeat(600)}\n${"b".repeat(600)}`
    expect(clamped(body)).toBe(body)
  })
})

/*
 * The parser must always consume a line — the one failure here that is not a
 * wrong render but a dead tab.
 *
 * Every field the detail fetch supplied went missing from the panel while the
 * header, fed from the row, stayed perfect, and the console carried no
 * exception at all — only `Uncaught out of memory`. With nothing thrown it read
 * as a component choosing its empty branch, which is the one thing it was not
 * doing: it never finished rendering.
 *
 * The mechanism is two patterns disagreeing about one line. GitHub returns
 * plenty of bodies with CRLF endings, `split("\n")` leaves the `\r` on the end
 * of every line, and then the heading branch `/^(#{1,6})\s+(.*)$/` does NOT
 * match `"## A\r"` — `.` cannot cross a `\r` and `$` wants end-of-input — while
 * the paragraph guard, a bare prefix with no `$`, matches it happily. No branch
 * consumes the line, `i` never advances, and an empty <p> is appended for ever.
 *
 * Headings are only the first door: both list matchers end in the same `(.*)$`,
 * so a CRLF body containing a LIST reaches the same non-termination by another
 * branch. That is why the fix normalises line endings at the split rather than
 * patching the single pattern that happened to be caught, and why the loop also
 * advances unconditionally when the paragraph collector takes nothing.
 *
 * These fail by TIMING OUT against the unfixed parser rather than by asserting
 * false, which is the honest shape for non-termination: there is no wrong value
 * to compare against, only an answer that never arrives. Run against the parser
 * as it was, they took the vitest worker down with an out-of-memory kill.
 */

/* The crashing payload's SHAPE, never its contents: CRLF breaks, `##` headings,
   inline backticks and a fenced block, which is how a real description tends to
   arrive. */
const CRLF_BODY = [
  "Restores the previous behaviour after the reversal path was corrected.",
  "",
  "## What happened",
  "",
  "The queue event was written once, up front, before the batch loop ran.",
  "The worker then handles one batch at a time and writes its rows on success.",
  "",
  "`items` carries `CONSTRAINT uidx UNIQUE (event_id, item_id)`, so one item",
  "can hold only a single row per event.",
  "",
  "### Why it matters",
  "",
  "```sql",
  "SELECT item_id, SUM(amount) FROM items GROUP BY item_id;",
  "```",
  "",
  "Only three event names ever carry these rows.",
].join("\r\n")

const CRLF_LIST = ["Intro line.", "", "- first", "- second", "- third"].join(
  "\r\n",
)

const blocksOf = (source: string) =>
  (Markdown({ source }) as { props: { children: unknown[] } }).props.children

describe("a body with CRLF line endings", () => {
  it(
    "terminates, and renders a bounded number of blocks",
    { timeout: 5000 },
    () => {
      const blocks = blocksOf(CRLF_BODY)

      /* The unfixed parser never reaches this line. If one ever does again, the
       count is the tell — it appended one empty paragraph per spin. */
      expect(blocks.length).toBeGreaterThan(0)
      expect(blocks.length).toBeLessThan(40)
    },
  )

  it(
    "terminates when the undecidable line is a list item",
    { timeout: 5000 },
    () => {
      expect(blocksOf(CRLF_LIST).length).toBeLessThan(40)
    },
  )

  /* Not merely "it did not hang": the heading has to arrive as a heading, or
     the fix would be satisfied by dropping the line on the floor. */
  it(
    "reads a CRLF heading as a heading, and keeps no carriage return",
    { timeout: 5000 },
    () => {
      const text = JSON.stringify(blocksOf(CRLF_BODY))

      expect(text).toContain("What happened")
      expect(text).not.toContain("\\r")
    },
  )
})
