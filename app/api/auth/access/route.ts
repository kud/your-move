import { NextResponse } from "next/server"

export const GET = async () => {
  const clientId = process.env.GITHUB_CLIENT_ID
  return NextResponse.redirect(
    clientId
      ? `https://github.com/settings/connections/applications/${clientId}`
      : "https://github.com/settings/applications",
    302,
  )
}
