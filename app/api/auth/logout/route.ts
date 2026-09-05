import { NextResponse } from "next/server"

import { COOKIE } from "@/lib/auth"

/*
 * POST rather than GET, so a stray <img src="/api/auth/logout"> on any page in
 * any tab cannot sign you out.
 */
export const POST = async (request: Request) => {
  const response = NextResponse.redirect(new URL("/login", request.url), 303)
  response.cookies.delete(COOKIE)
  return response
}
