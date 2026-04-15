/** External URLs so users can see photos or buy when we have no catalog image. */

function q(s: string): string {
  return encodeURIComponent(s.trim())
}

export function googleShoppingUrl(productName: string, brand?: string): string {
  const query = [productName, brand].filter(Boolean).join(" ")
  return `https://www.google.com/search?tbm=shop&q=${q(query)}`
}

export function googleImageSearchUrl(productName: string, brand?: string): string {
  const query = [productName, brand, "toy"].filter(Boolean).join(" ")
  return `https://www.google.com/search?tbm=isch&q=${q(query)}`
}
