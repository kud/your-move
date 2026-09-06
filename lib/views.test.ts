import { describe, expect, it } from "vitest"

import { exportViews, importViews, samePicks } from "./views.js"

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
