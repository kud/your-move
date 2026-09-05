/*
 * The session is the GitHub token, encrypted, in a cookie. There is no database.
 *
 * A user access token is a few hundred bytes, so the cheapest correct place to
 * keep it is the cookie itself — sealed with AES-GCM under a server-only key,
 * `HttpOnly` so client JS can never read it. That keeps the app genuinely
 * stateless: nothing to run, nothing to back up, and no component that can be
 * down while GitHub is up.
 *
 * This is not a compromised version of server-side storage. For a token used
 * only on behalf of whoever holds the cookie, there is nothing a store would add
 * except an outage surface — and a store's one genuine advantage, locking around
 * refresh-token rotation, does not apply while OAuth App tokens do not expire.
 *
 * Web Crypto rather than `node:crypto`, because middleware runs on the Edge
 * runtime where the node builtin is simply absent — and it fails at request
 * time, not at build time, so the wrong choice ships green.
 */

const encoder = new TextEncoder()
const decoder = new TextDecoder()

/*
 * SESSION_SECRET is a passphrase, not a key. AES-GCM needs exactly 256 bits, so
 * the secret is hashed to that length rather than truncated or padded — either
 * of which would silently narrow the keyspace for a short secret.
 */
const keyFor = async (secret: string): Promise<CryptoKey> =>
  crypto.subtle.importKey(
    "raw",
    await crypto.subtle.digest("SHA-256", encoder.encode(secret)),
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"],
  )

const toBase64Url = (bytes: Uint8Array): string =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "")

const fromBase64Url = (value: string): Uint8Array<ArrayBuffer> => {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/")
  const binary = atob(padded.padEnd(Math.ceil(padded.length / 4) * 4, "="))
  const bytes = new Uint8Array(new ArrayBuffer(binary.length))
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

/**
 * Seal a value into an opaque cookie string: `<iv>.<ciphertext>`.
 *
 * A fresh random IV every time, which AES-GCM requires — reusing one across two
 * messages under the same key is the failure that breaks GCM outright, not
 * merely weakens it.
 */
export const seal = async (secret: string, value: string): Promise<string> => {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const sealed = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    await keyFor(secret),
    encoder.encode(value),
  )
  return `${toBase64Url(iv)}.${toBase64Url(new Uint8Array(sealed))}`
}

/**
 * Open a sealed cookie, or return undefined.
 *
 * GCM authenticates as well as encrypts, so a tampered or truncated cookie
 * throws rather than decrypting to rubbish — which is why every failure here
 * collapses to the same "no session" answer. There is nothing to distinguish
 * and nothing useful to tell the caller apart from that.
 */
export const unseal = async (
  secret: string,
  token: string | undefined,
): Promise<string | undefined> => {
  if (!token) return undefined

  const [iv, payload] = token.split(".")
  if (!iv || !payload) return undefined

  try {
    const opened = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: fromBase64Url(iv) },
      await keyFor(secret),
      fromBase64Url(payload),
    )
    return decoder.decode(opened)
  } catch {
    return undefined
  }
}

/**
 * The OAuth `state` parameter: a random nonce, sealed the same way.
 *
 * It is not decorative. Without it, anyone can hand a victim a callback URL
 * carrying their own authorisation code and log the victim into the attacker's
 * account — login CSRF. Sealing rather than merely storing means the check needs
 * no server-side session to compare against, which is the whole point here.
 */
export const issueState = async (secret: string, to: string): Promise<string> =>
  seal(
    secret,
    JSON.stringify({
      nonce: toBase64Url(crypto.getRandomValues(new Uint8Array(16))),
      to,
      at: Date.now(),
    }),
  )

const STATE_LIFETIME_MS = 10 * 60 * 1000

/** Where to land after a valid callback, or undefined if the state is not ours. */
export const readState = async (
  secret: string,
  state: string | undefined,
  now: number,
): Promise<string | undefined> => {
  const opened = await unseal(secret, state)
  if (!opened) return undefined

  try {
    const { to, at } = JSON.parse(opened) as { to?: unknown; at?: unknown }
    if (typeof at !== "number" || now - at > STATE_LIFETIME_MS) return undefined

    /* Path only. An absolute URL here would make the callback an open redirect,
       which is exactly where one gets weaponised. */
    return typeof to === "string" && to.startsWith("/") && !to.startsWith("//")
      ? to
      : "/"
  } catch {
    return undefined
  }
}

export const COOKIE = "ym_session"
export const STATE_COOKIE = "ym_state"

/** Long on purpose: this is a board you glance at, not a bank. */
export const LIFETIME_MS = 90 * 24 * 60 * 60 * 1000
