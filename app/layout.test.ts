import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

/*
 * The pre-paint script in `app/layout.tsx` decides before the first pixel
 * whether the intro overlay shows. Read back out of the source rather than
 * restated: a copy here would pass while the shipped script regressed.
 */
const source = readFileSync(new URL("./layout.tsx", import.meta.url), "utf8")

const script = (): string => {
  const match = /__html: `([^`]*)`/.exec(source)
  if (!match) throw new Error("pre-paint inline script not found in layout.tsx")
  return match[1]
}

type Store = {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
  calls: string[]
}

const store = (): Store => {
  const calls: string[] = []
  const data = new Map<string, string>()
  return {
    getItem: (key: string) => {
      calls.push(`get:${key}`)
      return data.get(key) ?? null
    },
    setItem: (key: string, value: string) => {
      calls.push(`set:${key}`)
      data.set(key, value)
    },
    calls,
  }
}

/* One fresh load: a new root element, storage carried over like a real tab. */
const load = (
  code: string,
  pathname: string,
  local: Store,
  session: Store,
): Record<string, string> => {
  const dataset: Record<string, string> = {}
  const document = {
    documentElement: { dataset, style: {} as Record<string, string> },
    querySelector: () => ({ setAttribute: () => {} }),
  }
  const run = new Function(
    "document",
    "localStorage",
    "sessionStorage",
    "matchMedia",
    "location",
    code,
  )
  run(document, local, session, () => ({ matches: false }), { pathname })
  return dataset
}

describe("pre-paint intro flag", () => {
  it("plays the intro on every load of /, with no once-per-tab gate", () => {
    const code = script()
    const local = store()
    const session = store()

    /* Two loads sharing one tab's storage, as a refresh would. */
    expect(load(code, "/", local, session).intro).toBe("cold")
    expect(load(code, "/", local, session).intro).toBe("cold")

    /* The gate is gone entirely: storage that records every touch hears
       nothing about the intro, on any load. */
    expect(session.calls).toEqual([])
    expect(source).not.toContain("ym:intro")
    expect(source).not.toContain("sessionStorage")
  })

  it("leaves the intro off everywhere else", () => {
    const code = script()
    expect(load(code, "/login", store(), store()).intro).toBeUndefined()
  })
})

describe("reference deployment", () => {
  it("points previews at the new domain", () => {
    expect(source).toContain("https://your-move.beansontoast.app")
    /* Lookbehind: the new domain contains the old one as a suffix. */
    expect(source).not.toMatch(/(?<!your-)move\.beansontoast\.app/)
  })
})
