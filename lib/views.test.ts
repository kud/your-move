import { describe, expect, it } from "vitest"

import {
  decodeShare,
  encodeShare,
  exportViews,
  importViews,
  samePicks,
} from "./views.js"

/*
 * This parses a file a human may have opened and edited, and a file written by
 * a version of the app that no longer exists. Both are ordinary, and both fail
 * the same way if the parser trusts what it is given: a filter sheet that
 * throws, or one silently holding `undefined` where an array belongs.
 *
 * So the contract asserted here is narrow and total — anything unrecognised is
 * dropped, and what survives is always the right shape.
 */

const picks = (over = {}) => ({
  repos: [],
  owners: [],
  status: [],
  labels: [],
  move: [],
  ...over,
})

describe("importViews", () => {
  it("round-trips what export writes", () => {
    const views = [{ name: "At work", picks: picks({ repos: ["a/b"] }) }]
    const back = importViews(exportViews(views))
    expect(back).toHaveLength(1)
    expect(back[0].name).toBe("At work")
    expect(samePicks(back[0].picks, views[0].picks)).toBe(true)
  })

  /* What a hand-edit most likely produces. Refusing it would be pedantry. */
  it("accepts a bare array as well as the wrapped form", () => {
    const back = importViews('[{"name":"Home","picks":{"move":["you"]}}]')
    expect(back[0].picks.move).toEqual(["you"])
  })

  it("fills every facet a file has never heard of", () => {
    const back = importViews('{"views":[{"name":"Old","picks":{"repos":["a/b"]}}]}')
    expect(back[0].picks).toEqual(picks({ repos: ["a/b"] }))
  })

  it("drops entries with no usable name", () => {
    const back = importViews('[{"picks":{}},{"name":"   "},{"name":"Real"}]')
    expect(back.map((v) => v.name)).toEqual(["Real"])
  })

  it("drops values that are not strings, rather than trusting them", () => {
    const back = importViews(
      '[{"name":"Odd","picks":{"repos":["a/b",7,null],"move":["you","sideways"]}}]',
    )
    expect(back[0].picks.repos).toEqual(["a/b"])
    expect(back[0].picks.move).toEqual(["you"])
  })

  it("survives a facet that is not an array at all", () => {
    const back = importViews('[{"name":"Bent","picks":{"repos":"a/b"}}]')
    expect(back[0].picks.repos).toEqual([])
  })
})

/*
 * The link carries the same set through a URL fragment. Its one hard contract
 * is that anything unreadable is NOTHING rather than an error: chat clients
 * truncate links, and a board that threw on arrival would be announcing a
 * failure about a feature the reader may not know they used.
 */
describe("encodeShare / decodeShare", () => {
  it("round-trips a set through a fragment", () => {
    const views = [
      { name: "At work", picks: picks({ repos: ["acme/widgets"] }) },
      { name: "Mine", picks: picks({ move: ["you"] }) },
    ]
    const back = decodeShare(encodeShare(views))
    expect(back.map((v) => v.name)).toEqual(["At work", "Mine"])
    expect(samePicks(back[0].picks, views[0].picks)).toBe(true)
  })

  it("survives non-ASCII names, which base64 of a raw string would not", () => {
    const back = decodeShare(encodeShare([{ name: "Été · 日本", picks: picks() }]))
    expect(back[0].name).toBe("Été · 日本")
  })

  it("produces a fragment-safe value with nothing needing escaping", () => {
    const value = encodeShare([{ name: "At work", picks: picks({ repos: ["a/b"] }) }])
    expect(value).toMatch(/^[A-Za-z0-9_-]+$/)
  })

  for (const broken of ["", "not-base64!!", "eyJ2Ijox", "%%%"])
    it(`returns nothing for ${JSON.stringify(broken)} rather than throwing`, () => {
      expect(decodeShare(broken)).toEqual([])
    })
})

/*
 * An owner pick is the one facet that is a predicate rather than a snapshot, so
 * the contract worth pinning is that an old file keeps its enumeration and
 * gains nothing — it is NOT collapsed into the owner it happens to cover. Twenty
 * of twenty ticked is ambiguous between "the org" and "these twenty", and
 * guessing would silently widen a view where a repository was excluded on
 * purpose.
 */
describe("owners", () => {
  it("fills owners for a file written before the facet existed", () => {
    const back = importViews(
      JSON.stringify({
        views: [{ name: "At work", picks: { repos: ["acme/a", "acme/b"] } }],
      }),
    )
    expect(back[0].picks.owners).toEqual([])
    expect(back[0].picks.repos).toEqual(["acme/a", "acme/b"])
  })

  it("round-trips an owner pick", () => {
    const views = [{ name: "At work", picks: picks({ owners: ["acme"] }) }]
    expect(importViews(exportViews(views))).toEqual(views)
  })

  it("tells an owner pick apart from its repos being ticked", () => {
    expect(
      samePicks(picks({ owners: ["acme"] }), picks({ repos: ["acme/a"] })),
    ).toBe(false)
  })
})
