# How Supreme Odoo works (data → screens)

This document describes how data flows through the app, what each screen does, and how Odoo fits in. It matches the current codebase.

---

## Big picture

- **Odoo** is the system of record for products, stock, and (after you use the buttons) draft **purchase orders** and **sales orders**.
- **This app** adds planning layers: demand view, shelf-price (RSP) math, reorder quantities, inventory labels, light promo ideas, and a **workflow** that ties steps together.
- Some state lives **only in the browser** (approved prices, saved PO draft). It is **not** synced to Odoo unless you call the create-PO / create-SO actions.

---

## 1. Connection

**What happens**

- On load, the client calls `GET /api/odoo/dashboard`.
- The server reads `ODOO_URL`, `ODOO_DATABASE`, `ODOO_USERNAME`, and `ODOO_API_KEY` from `.env`.
- If all are set, it authenticates with Odoo’s **JSON-RPC** API, reads **stockable products** (`product.product`), optionally enriches with **~90 day sale line totals** (`sale.order.line`), and returns a **catalog** the UI treats as `variants`.
- Each Odoo row includes a numeric **`odooProductId`** (the real `product.product` id). That id is required later to **create PO/SO lines** in Odoo.
- If Odoo is missing or the call fails, the API returns **`connected: false`** and the UI falls back to **`DEMO_VARIANTS`** (`lib/demo-variants.ts`) so every screen still works. Demo rows **do not** have `odooProductId`, so **Create PO / Create SO in Odoo** will not work until you use a live catalog.

**Where in code**

- `app/api/odoo/dashboard/route.ts` — fetch + map.
- `lib/odoo/map.ts` — maps Odoo fields to the shared variant shape.
- `hooks/use-odoo-live.ts` + `hooks/use-variants-with-odoo.ts` — client data source.

---

## 2. Demand (`/prediction`)

**What you do**

- Choose a **SKU** (dropdown with thumbnail when available).

**What the app shows**

- **Demand score (%)** — a single number for “how strong demand might look” over about the next month. It is **not** a forecast guarantee; it is a **model** built from:
  - **Trend score** on that SKU (from the catalog row),
  - **Weeks of stock / cover** (low cover pushes the score up, very high cover pulls it down),
  - **Recent sales** if Odoo returned `salesQty90d` for that product,
  - **Sliders** you can move (search / marketplaces / social, plus optional region and category sliders),
  - The score is **clamped** (roughly 12–94%) with a **rough range** shown beside it.
- **Breakdown list** — each factor shows points and a short explanation.
- **Suggested buy** — uses the same **reorder-style math** as Restock: target + lead + safety weeks × **estimated units per week**, minus on-hand and inbound, with a **timing** hint (order now / delay / hold).
- **Units per week chart** — estimated recent weeks plus a short “next weeks” curve for context.

**Where in code**

- `components/prediction-workspace.tsx`
- `lib/intelligence.ts` — `demandProbabilityBreakdown`, `orderTimingAdvice`, `suggestedReorderQty`
- `lib/planning-math.ts` — `weeklyDemand`, `buildWeeklyForecast`

---

## 3. Price / RSP (`/pricing`)

**What you do**

- Pick a SKU, enter **landed cost (₹)** and optionally **competitor price (₹)**, set **target margin %**, and move the **tilt** slider (more “move stock” vs “keep margin”).

**What the app shows**

- A **suggested shelf price** in rupees, with **margin** and **profit per unit**, and optionally **vs competitor %**.
- Two **alternate prices** (lower / higher) with short notes.
- A **price ladder** chart and **step-by-step** text of how the number was blended (cost path, competitor path, mix, then trend multiplier).

**Approve price**

- **Approve price** stores a record in **`localStorage`** for that SKU: SKU name, suggested RSP, timestamp, and optional cost inputs (`lib/workflow-storage.ts`, `hooks/use-workflow-state.ts`).
- This is **only in this browser**. It is **not** written to Odoo. It exists so **Workflow** and **Restock** can remind you that pricing was agreed before buying.

**Where in code**

- `components/pricing-workspace.tsx`
- `lib/intelligence.ts` — `computeRspAnalysis`, `pricingPowerHint`

---

## 4. Restock (`/smart-orders`)

**What the app does (all SKUs)**

- Estimates **units per week** from **on hand** and **weeks of cover** (same family of logic as planning math).
- Computes a **target stock** in units for **target + lead + safety** weeks, subtracts **on hand + inbound**, and rounds up to a **suggested order quantity** per line.
- Applies a **preset** (template) that can **raise or cap** the final quantity (e.g. new supplier trial cap, bump after thin cover, +5% after “approved RSP” style preset).

**What you can export**

- **Copy draft** — human-readable block for email/notes.
- **Copy CSV** — structured columns for spreadsheets or middleware.
- **Save for Odoo PO** — writes the lines with **final quantity > 0** into **`localStorage`** (`lib/po-draft-storage.ts`), including `odooProductId` when the row came from Odoo. The **Workflow** page reads this draft to **create a real draft PO**.

**Where in code**

- `components/smart-orders-workspace.tsx`
- `lib/planning-math.ts` — `reorderRows`, `reorderBreakdown`, `weeklyDemand`
- `lib/intelligence.ts` — `applyTemplateToOrderQty`, `orderTimingAdvice`

---

## 5. Inventory (`/stock-health`)

**What the app does**

- For every SKU, assigns a **label** (e.g. running low, slow seller, lots in stock) using **trend score**, **weeks of cover**, **on hand**, and **implied weekly demand**.
- Shows **days of stock left (rough)** when demand is known, optional **90d sales**, filters, sort, CSV export, and a small **count-by-label** chart.

**Where in code**

- `components/stock-health-workspace.tsx`
- `lib/intelligence.ts` — `stockHealthRow`, `deadStockValueHint`

---

## 6. Ideas (`/conversion`)

**What the app does**

- Generates a few **plain-language promo / bundle / channel** ideas from **top trend SKUs** and **slow movers** in the current catalog. No Odoo write; inspiration only.

**Where in code**

- `components/conversion-workspace.tsx`
- `lib/intelligence.ts` — `purchaseToSalesIdeas`

---

## 7. Workflow (`/workflow`)

**What it is**

- A **step map** linking Demand → Price → Restock → **Odoo PO** → **Odoo SO** → **stock confirmation**.
- **Approved shelf prices** (from step 3) listed from browser storage.
- **Purchase order in Odoo**
  - Loads the **PO draft** saved from Restock (**Save for Odoo PO**).
  - You set **vendor** as a numeric **`res.partner` id** (or use `ODOO_PO_PARTNER_ID` in `.env`; the app prefills from `GET /api/odoo/status`).
  - **Create draft PO** calls `POST /api/odoo/purchase-order` with `{ partnerId, lines: [{ productId, quantity }] }`. The server uses Odoo **`purchase.order`** `create` with **order lines** (`lib/odoo/create-orders.ts`).
  - Lines **without** `odooProductId` are skipped (typical for demo data).
- **Sales order in Odoo**
  - You build **SKU × qty** lines (same list used for the stock report).
  - **Customer** id: type it or use `ODOO_SO_PARTNER_ID` in `.env`.
  - **Create draft SO** calls `POST /api/odoo/sale-order` with **`sale.order`** `create` and **`product_uom_qty`** on lines.
- **Stock confirmation report**
  - For the same lines, compares **requested qty** to **sellable** stock (**on hand − reserved**).
  - Produces a **text report** you can copy (not AI; deterministic).

**Partner ids in Odoo**

- Open a contact in Odoo; the **database id** often appears in the URL (`id=…`) or via developer mode. Put defaults in `.env` so the Workflow fields prefill.

**Where in code**

- `components/workflow-workspace.tsx`
- `app/api/odoo/purchase-order/route.ts`, `app/api/odoo/sale-order/route.ts`
- `lib/stock-confirmation.ts`, `lib/po-draft-storage.ts`, `lib/workflow-storage.ts`

---

## API summary (server)

| Route | Role |
|--------|------|
| `GET /api/odoo/dashboard` | Catalog + optional sales totals + recent SO list for display |
| `GET /api/odoo/status` | Safe flags + default PO/SO partner ids from env |
| `POST /api/odoo/test` | Connection smoke test |
| `POST /api/odoo/purchase-order` | Create draft **purchase.order** |
| `POST /api/odoo/sale-order` | Create draft **sale.order** |
| `POST /api/ai/insights` | Optional LLM insight (not wired to a main screen by default) |

---

## What is still “manual” or local

- **Approved RSP** — browser only until you build a model/field in Odoo.
- **PO draft** — browser **`localStorage`** until you persist it server-side.
- **Confirming** PO/SO in Odoo (send to vendor, confirm delivery, invoice, etc.) — done in **Odoo’s UI** (or future automation).

---

## Environment variables (minimal list)

**Odoo connection**

- `ODOO_URL`, `ODOO_DATABASE`, `ODOO_USERNAME`, `ODOO_API_KEY`

**Workflow defaults (optional but convenient)**

- `ODOO_PO_PARTNER_ID` — vendor `res.partner` id for PO create  
- `ODOO_SO_PARTNER_ID` — customer `res.partner` id for SO create  

**Optional AI**

- `OPENROUTER_API_KEY`, `OPENROUTER_MODEL` — for `/api/ai/insights` if you hook it into the UI

---

## Glossary (short)

| Term | Meaning here |
|------|----------------|
| **RSP** | Retail shelf price — what you plan to sell at. |
| **SKU** | Product code in the catalog. |
| **Weeks of cover** | Rough “how long current stock lasts” at the app’s implied pace. |
| **Trend score** | A 0–100 style strength signal on the row (not raw Google Trends unless you treat sliders that way). |
| **Demand score** | Percentage summary of near-term demand strength from the model. |
| **Preset / template** | Rule that adjusts Restock **final** quantity. |
| **Sellable** | On hand minus reserved (what you can still promise). |
| **odooProductId** | Odoo `product.product` id — needed for RPC line creation. |
