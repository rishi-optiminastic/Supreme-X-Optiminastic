/** Top bar label for the current pathname (first matching prefix). */
export function shellCrumbForPath(pathname: string): string {
  if (pathname === "/") return "Overview"
  const rules: [prefix: string, label: string][] = [
    ["/inventory", "Inventory"],
    ["/warehouse", "Warehouse"],
    ["/forecasting", "Forecasting"],
    ["/reorder", "Reorder"],
    ["/alerts", "Alerts"],
    ["/purchases", "Purchases"],
    ["/analytics", "Sales"],
    ["/market-signals", "Market"],
    ["/scenarios", "Scenarios"],
    ["/suppliers", "Suppliers"],
    ["/integrations", "Integrations"],
    ["/trends", "Trends"],
    ["/signals", "Signals"],
    ["/settings", "Settings"],
  ]
  for (const [prefix, label] of rules) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) return label
  }
  return "App"
}
