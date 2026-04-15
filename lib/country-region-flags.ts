/**
 * Map free-text region labels from AI to ISO 3166-1 alpha-2 for flagcdn.com.
 * "Global" / unknown → null (caller shows a globe icon).
 */
const LABEL_TO_ISO2: Record<string, string> = {
  "united states": "us",
  "united states of america": "us",
  usa: "us",
  us: "us",
  america: "us",
  canada: "ca",
  mexico: "mx",
  "united kingdom": "gb",
  uk: "gb",
  britain: "gb",
  england: "gb",
  scotland: "gb",
  wales: "gb",
  ireland: "ie",
  france: "fr",
  germany: "de",
  italy: "it",
  spain: "es",
  japan: "jp",
  china: "cn",
  india: "in",
  brazil: "br",
  australia: "au",
  "south korea": "kr",
  korea: "kr",
  "new zealand": "nz",
  netherlands: "nl",
  belgium: "be",
  sweden: "se",
  norway: "no",
  denmark: "dk",
  finland: "fi",
  poland: "pl",
  singapore: "sg",
  "hong kong": "hk",
  taiwan: "tw",
  thailand: "th",
  vietnam: "vn",
  indonesia: "id",
  malaysia: "my",
  philippines: "ph",
  "south africa": "za",
  "united arab emirates": "ae",
  uae: "ae",
  switzerland: "ch",
  austria: "at",
  israel: "il",
  turkey: "tr",
  russia: "ru",
  argentina: "ar",
  chile: "cl",
  colombia: "co",
  "european union": "eu",
  europe: "eu",
  eu: "eu",
}

const GLOBAL_LABELS = new Set([
  "global",
  "worldwide",
  "world",
  "international",
  "multiple",
  "multi-region",
  "multi region",
])

export function countryLabelToIso2(label: string): string | null {
  const k = label.trim().toLowerCase()
  if (!k) return null
  if (GLOBAL_LABELS.has(k)) return null
  if (LABEL_TO_ISO2[k]) return LABEL_TO_ISO2[k]
  return null
}
