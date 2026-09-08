import { describe, expect, it } from "vitest"

import { clamped, safeHref } from "./markdown.js"

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
