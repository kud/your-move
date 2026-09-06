import { describe, expect, it } from "vitest"

import { safeHref } from "./markdown.js"

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
