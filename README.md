# Supreme Odoo

Next.js app that connects to **Odoo** (or demo data) for inventory-aware **demand**, **shelf price (RSP)**, **restock** planning, **inventory labels**, **workflow** (draft PO/SO in Odoo + stock confirmation), and light **ideas**.

**Full walkthrough:** [docs/how-it-works.md](./docs/how-it-works.md)

---

## Stack

Next.js (App Router), Tailwind, shadcn-style UI, Odoo JSON-RPC, optional OpenRouter for `/api/ai/insights`.

---

## Original template note

Below is the original shadcn template blurb for adding components.

## Adding components

To add components to your app, run the following command:

```bash
npx shadcn@latest add button
```

This will place the ui components in the `components` directory.

## Using components

To use the components in your app, import them as follows:

```tsx
import { Button } from "@/components/ui/button";
```
