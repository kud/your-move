import type { ReactNode } from "react"

/*
 * A deliberately small markdown renderer.
 *
 * Two things it is not, and both are the point.
 *
 * It is **not a full renderer**. `detail.tsx` exists to let you decide, not to
 * let you work, and the bright line there is the diff: the moment this panel
 * becomes a good reader, it is a worse GitHub. So headings, emphasis, code,
 * lists, quotes and links are in — they are what a description uses to be
 * legible — and images, tables and HTML are out. An image would turn a decision
 * into a page load; a table would ask a 620px panel to hold a layout it cannot.
 *
 * It is **not HTML**. It returns React nodes, so there is no
 * `dangerouslySetInnerHTML` and no sanitiser to keep correct. This text is
 * written by whoever opened the issue — a stranger, on a repo you do not own —
 * and the safest way to render a stranger's markup is never to build markup
 * from it at all. That rules out an XSS class rather than defending against it,
 * which is why this is hand-rolled rather than `marked` plus a sanitiser: the
 * dependency would be the smaller half of the job, and the sanitiser the part
 * that had to stay right forever.
 *
 * Anything it does not recognise falls through as text. A renderer that drops
 * what it cannot parse would lose the sentence that mattered.
 */

/*
 * Code spans come first so nothing inside them is parsed further — otherwise
 * `**kwargs` in a code span renders as bold, which is exactly the kind of wrong
 * that looks deliberate.
 */
const INLINE = new RegExp(
  [
    "(`[^`]+`)",
    "(\\*\\*[^*]+\\*\\*)",
    "(__[^_]+__)",
    "(~~[^~]+~~)",
    "(\\*[^*\\s][^*]*\\*)",
    "(!?\\[[^\\]]*\\]\\([^)\\s]+\\))",
    "(https?://[^\\s<>()]+)",
  ].join("|"),
  "g",
)

const LINK = /^(!?)\[([^\]]*)\]\(([^)\s]+)\)$/

/* http and https only: a `javascript:` or `data:` href is the one way a link
   can still be an attack once the markup itself is safe. */
export const safeHref = (href: string) => /^https?:\/\//i.test(href)

const anchor = "text-accent underline underline-offset-2 hover:text-fg"

const inline = (text: string, key: string): ReactNode[] => {
  const out: ReactNode[] = []
  let last = 0
  let i = 0

  for (const match of text.matchAll(INLINE)) {
    const at = match.index
    if (at > last) out.push(text.slice(last, at))
    const token = match[0]
    const id = `${key}-${i++}`

    if (token.startsWith("`"))
      out.push(
        <code
          key={id}
          className="rounded bg-panel-2 px-1 py-px font-mono text-[0.92em] text-fg"
        >
          {token.slice(1, -1)}
        </code>,
      )
    else if (token.startsWith("**") || token.startsWith("__"))
      out.push(
        <b key={id} className="font-semibold text-fg">
          {token.slice(2, -2)}
        </b>,
      )
    else if (token.startsWith("~~"))
      out.push(
        <s key={id} className="text-fg-quiet">
          {token.slice(2, -2)}
        </s>,
      )
    else if (token.startsWith("*"))
      out.push(<i key={id}>{token.slice(1, -1)}</i>)
    else if (LINK.test(token)) {
      const [, bang, label, href] = token.match(LINK) as RegExpMatchArray
      /* An image becomes a link to itself: the panel stays a decision, and the
         picture is still one click away rather than silently gone. */
      out.push(
        safeHref(href) ? (
          <a
            key={id}
            href={href}
            target="_blank"
            rel="noreferrer"
            className={anchor}
          >
            {bang ? `🖼 ${label || "image"}` : label || href}
          </a>
        ) : (
          <span key={id}>{label}</span>
        ),
      )
    } else
      out.push(
        <a
          key={id}
          href={token}
          target="_blank"
          rel="noreferrer"
          className={anchor}
        >
          {token}
        </a>,
      )

    last = at + token.length
  }

  if (last < text.length) out.push(text.slice(last))
  return out
}

const HEADING = ["", "text-[15px]", "text-[14.5px]", "text-[14px]"]

export const Markdown = ({ source }: { source: string }) => {
  const lines = source.split("\n")
  const blocks: ReactNode[] = []
  let i = 0

  const flushList = (ordered: boolean) => {
    const items: string[] = []
    while (i < lines.length) {
      const item = lines[i].match(
        ordered ? /^\s*\d+[.)]\s+(.*)$/ : /^\s*[-*+]\s+(.*)$/,
      )
      if (!item) break
      items.push(item[1])
      i++
    }
    const List = ordered ? "ol" : "ul"
    blocks.push(
      <List
        key={`l${blocks.length}`}
        className={`my-2 ml-4 flex flex-col gap-1 ${ordered ? "list-decimal" : "list-disc"}`}
      >
        {items.map((item, n) => {
          /* Task lists stay text rather than becoming checkboxes: a checkbox
             you cannot tick is worse than a written one. */
          const task = item.match(/^\[([ xX])\]\s+(.*)$/)
          return (
            <li key={n} className="pl-0.5 marker:text-fg-quiet">
              {task ? (
                <>
                  <span aria-hidden className="mr-1 font-mono text-fg-quiet">
                    {task[1] === " " ? "☐" : "☑"}
                  </span>
                  {inline(task[2], `${blocks.length}-${n}`)}
                </>
              ) : (
                inline(item, `${blocks.length}-${n}`)
              )}
            </li>
          )
        })}
      </List>,
    )
  }

  while (i < lines.length) {
    const line = lines[i]

    if (!line.trim()) {
      i++
      continue
    }

    /* Fenced code, including an unclosed fence — a description truncated
       mid-block is common, and it should render as code rather than as the
       rest of the document in monospace. */
    if (/^\s*```/.test(line)) {
      const body: string[] = []
      i++
      while (i < lines.length && !/^\s*```/.test(lines[i]))
        body.push(lines[i++])
      i++
      blocks.push(
        <pre
          key={`c${blocks.length}`}
          className="my-2 overflow-x-auto rounded-lg border border-line bg-panel-2 p-2.5 font-mono text-[12px] leading-[1.5] text-fg-mute"
        >
          {body.join("\n")}
        </pre>,
      )
      continue
    }

    const heading = line.match(/^(#{1,6})\s+(.*)$/)
    if (heading) {
      blocks.push(
        <p
          key={`h${blocks.length}`}
          className={`mt-3 font-semibold text-fg first:mt-0 ${
            HEADING[Math.min(heading[1].length, 3)]
          }`}
        >
          {inline(heading[2], `h${blocks.length}`)}
        </p>,
      )
      i++
      continue
    }

    if (/^\s*([-*_])\s*\1\s*\1[\s-*_]*$/.test(line)) {
      blocks.push(
        <hr key={`r${blocks.length}`} className="my-3 border-line-soft" />,
      )
      i++
      continue
    }

    if (/^\s*>\s?/.test(line)) {
      const body: string[] = []
      while (i < lines.length && /^\s*>\s?/.test(lines[i]))
        body.push(lines[i++].replace(/^\s*>\s?/, ""))
      blocks.push(
        <blockquote
          key={`q${blocks.length}`}
          className="my-2 border-l-2 border-line pl-3 text-fg-quiet"
        >
          {inline(body.join(" "), `q${blocks.length}`)}
        </blockquote>,
      )
      continue
    }

    if (/^\s*[-*+]\s+/.test(line)) {
      flushList(false)
      continue
    }
    if (/^\s*\d+[.)]\s+/.test(line)) {
      flushList(true)
      continue
    }

    /* A paragraph runs until a blank line or the start of another block. */
    const body: string[] = []
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^\s*(```|#{1,6}\s|>|[-*+]\s|\d+[.)]\s)/.test(lines[i])
    )
      body.push(lines[i++])

    blocks.push(
      <p key={`p${blocks.length}`} className="my-2 first:mt-0">
        {inline(body.join(" "), `p${blocks.length}`)}
      </p>,
    )
  }

  return (
    <div className="text-[13.5px] leading-[1.55] text-fg-mute [&>*:first-child]:mt-0">
      {blocks}
    </div>
  )
}
