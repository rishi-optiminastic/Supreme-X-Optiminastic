export type OdooEnvConfig = {
  url: string
  database: string
  username: string
  apiKey: string
  configured: boolean
}

export function getOdooEnv(): OdooEnvConfig {
  const url = (process.env.ODOO_URL ?? "").trim()
  const database = (process.env.ODOO_DATABASE ?? "").trim()
  const username = (
    process.env.ODOO_USERNAME ??
    process.env.ODOO_LOGIN ??
    ""
  ).trim()
  const apiKey = (process.env.ODOO_API_KEY ?? "").trim()
  return {
    url,
    database,
    username,
    apiKey,
    configured: Boolean(url && database && username && apiKey),
  }
}

/** Safe to expose to the client */
function parseOptionalInt(v: string | undefined): number | null {
  const n = Number.parseInt((v ?? "").trim(), 10)
  return Number.isFinite(n) && n > 0 ? n : null
}

/** Default vendor (PO) and customer (SO) `res.partner` ids — set in .env for one-click create. */
export function getOdooWorkflowPartnerIds() {
  return {
    poPartnerId: parseOptionalInt(process.env.ODOO_PO_PARTNER_ID),
    soPartnerId: parseOptionalInt(process.env.ODOO_SO_PARTNER_ID),
  }
}

export function getOdooStatusPublic() {
  const c = getOdooEnv()
  const partners = getOdooWorkflowPartnerIds()
  let host = ""
  try {
    if (c.url) host = new URL(c.url).hostname
  } catch {
    host = ""
  }
  return {
    configured: c.configured,
    urlHost: host,
    databaseSet: Boolean(c.database),
    usernameSet: Boolean(c.username),
    apiKeySet: Boolean(c.apiKey),
    openrouterConfigured: Boolean(
      (process.env.OPENROUTER_API_KEY ?? "").trim()
    ),
    defaultPoPartnerId: partners.poPartnerId,
    defaultSoPartnerId: partners.soPartnerId,
  }
}
