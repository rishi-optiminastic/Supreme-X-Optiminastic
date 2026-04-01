/**
 * Odoo JSON-RPC (same wire format as Python xmlrpc.client usage).
 * @see https://www.odoo.com/documentation/master/developer/misc/api/odoo.html
 */

export async function odooJsonRpc<T = unknown>(
  baseUrl: string,
  service: string,
  method: string,
  args: unknown[]
): Promise<T> {
  const base = baseUrl.replace(/\/$/, "")
  const url = `${base}/jsonrpc`
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "call",
      params: { service, method, args },
      id: Math.floor(Math.random() * 1e9),
    }),
    cache: "no-store",
  })

  const json = (await res.json()) as {
    result?: T
    error?: { message?: string; data?: { message?: string; name?: string } }
  }

  if (json.error) {
    const msg =
      json.error.data?.message ??
      json.error.message ??
      "Odoo JSON-RPC error"
    throw new Error(msg)
  }

  return json.result as T
}

export async function odooAuthenticate(
  baseUrl: string,
  database: string,
  login: string,
  apiKey: string
): Promise<number> {
  const uid = await odooJsonRpc<number | false>(
    baseUrl,
    "common",
    "authenticate",
    [database, login, apiKey, {}]
  )
  if (uid === false || typeof uid !== "number") {
    throw new Error("Authentication failed — check database, login, and API key")
  }
  return uid
}

export async function odooExecuteKw<T = unknown>(
  baseUrl: string,
  database: string,
  uid: number,
  apiKey: string,
  model: string,
  method: string,
  args: unknown[],
  kwargs: Record<string, unknown> = {}
): Promise<T> {
  return odooJsonRpc<T>(baseUrl, "object", "execute_kw", [
    database,
    uid,
    apiKey,
    model,
    method,
    args,
    kwargs,
  ])
}
