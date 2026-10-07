import { afterEach, describe, expect, it } from "vitest"

const saved = { ...process.env }

afterEach(() => {
  process.env = { ...saved }
})

const { GET } = await import("./route")

const locationOf = (response: Response): string =>
  response.headers.get("location") ?? ""

describe("GET /api/auth/access", () => {
  it("sends a configured app to its own access page", async () => {
    process.env.GITHUB_CLIENT_ID = "id"

    const response = await GET()

    expect(response.status).toBe(302)
    expect(locationOf(response)).toBe(
      "https://github.com/settings/connections/applications/id",
    )
  })

  it("falls back to the applications list with no client id", async () => {
    delete process.env.GITHUB_CLIENT_ID

    const response = await GET()

    expect(response.status).toBe(302)
    expect(locationOf(response)).toBe(
      "https://github.com/settings/applications",
    )
  })
})
