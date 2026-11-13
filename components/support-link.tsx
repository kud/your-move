"use client"

import { useRef, useSyncExternalStore, type MouseEvent } from "react"

const emptySubscribe = () => () => {}

/*
 * Built in the browser from parts, so no served HTML or bundle carries the
 * address whole for a scraper to find. The minifier folds constant joins, so
 * the separator comes from a map it leaves alone. The server renders the link
 * bare.
 */
export const supportAddress = () => {
  const at = [63].map((code) => String.fromCharCode(code + 1)).join("")
  return ["support+your-move", "beansontoast.app"].join(at)
}

const mailUrl = (query = "") => ["mailto", supportAddress() + query].join(":")

/* The note becomes a pre-filled message in the visitor's mail app. Nothing is
   sent from the page. */
export const composeSupportMail = (name: string, message: string) => {
  const from = name.trim()
  const text = message.trim()
  const subject = from ? `Your Move support, from ${from}` : "Your Move support"
  const body = from ? `${text}\n\n${from}` : text
  return mailUrl(
    `?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`,
  )
}

/* A modifier click means "do what links do", so it keeps the plain address. */
const opensElsewhere = (event: MouseEvent) =>
  event.button !== 0 ||
  event.metaKey ||
  event.ctrlKey ||
  event.shiftKey ||
  event.altKey

const field =
  "w-full rounded-lg border border-line bg-panel-2 px-3 py-2 text-[14px] text-fg placeholder:text-fg-quiet"

export const SupportLink = () => {
  const address = useSyncExternalStore(
    emptySubscribe,
    supportAddress,
    () => null,
  )
  const dialog = useRef<HTMLDialogElement>(null)
  const form = useRef<HTMLFormElement>(null)

  const open = (event: MouseEvent<HTMLAnchorElement>) => {
    const element = dialog.current
    if (!element || typeof element.showModal !== "function") return
    if (opensElsewhere(event)) return
    event.preventDefault()
    element.returnValue = ""
    element.showModal()
  }

  const closed = () => {
    const element = dialog.current
    const fields = form.current
    if (!element || !fields || element.returnValue !== "send") return
    const data = new FormData(fields)
    window.location.href = composeSupportMail(
      String(data.get("name") ?? ""),
      String(data.get("message") ?? ""),
    )
    fields.reset()
  }

  return (
    <>
      <a
        href={address ? mailUrl() : undefined}
        onClick={open}
        className="cursor-pointer underline decoration-line underline-offset-2 hover:text-fg hover:decoration-accent"
      >
        Get support
      </a>
      <dialog
        ref={dialog}
        aria-labelledby="support-title"
        onClose={closed}
        /* A click on the backdrop lands on the dialog itself; the card is the
           form, which fills it edge to edge. */
        onClick={(event) => {
          if (event.target === event.currentTarget) event.currentTarget.close()
        }}
        className="m-auto w-[min(26rem,calc(100vw-2rem))] rounded-2xl border border-line bg-panel p-0 text-left whitespace-normal text-[13.5px] text-fg shadow-[0_30px_80px_-30px_rgba(0,0,0,.9)] backdrop:bg-black/40 backdrop:backdrop-blur-[3px]"
      >
        <form ref={form} method="dialog" className="flex flex-col gap-3 p-5">
          <h2
            id="support-title"
            className="font-serif text-[19px] font-semibold tracking-[-0.015em]"
          >
            Get support
          </h2>
          <p className="leading-[1.55] text-fg-mute">
            Write it here and your mail app opens with it, ready to send.
            Nothing leaves this page.
          </p>
          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] text-fg-mute">
              Your name <span className="text-fg-quiet">(optional)</span>
            </span>
            <input
              name="name"
              autoComplete="name"
              maxLength={80}
              className={field}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] text-fg-mute">What&rsquo;s up?</span>
            <textarea
              name="message"
              rows={5}
              required
              maxLength={2000}
              className={`${field} resize-y leading-[1.5]`}
            />
          </label>
          <div className="mt-1 flex flex-wrap justify-end gap-2">
            <button
              type="submit"
              value="cancel"
              formNoValidate
              className="rounded-lg border border-line px-3 py-1.5 text-[13.5px] text-fg-mute transition-colors hover:text-fg"
            >
              Not now
            </button>
            <button
              type="submit"
              value="send"
              className="rounded-lg border border-accent bg-accent-dim px-3 py-1.5 text-[13.5px] text-accent"
            >
              Open in my mail app
            </button>
          </div>
        </form>
      </dialog>
    </>
  )
}
