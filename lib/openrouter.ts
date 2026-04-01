const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"

export async function openRouterChat(
  userPrompt: string,
  systemPrompt: string
): Promise<string> {
  const key = (process.env.OPENROUTER_API_KEY ?? "").trim()
  if (!key) {
    throw new Error("OPENROUTER_API_KEY is not set")
  }

  const model =
    (process.env.OPENROUTER_MODEL ?? "openai/gpt-4o-mini").trim() ||
    "openai/gpt-4o-mini"

  const referer =
    (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").trim()

  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      "HTTP-Referer": referer,
      "X-Title": "Supreme Odoo",
    },
    body: JSON.stringify({
      model,
      temperature: 0.35,
      max_tokens: 1400,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
    cache: "no-store",
  })

  if (!res.ok) {
    const t = await res.text()
    throw new Error(`OpenRouter ${res.status}: ${t.slice(0, 200)}`)
  }

  const json = (await res.json()) as {
    choices?: { message?: { content?: string } }[]
  }
  const text = json.choices?.[0]?.message?.content?.trim()
  if (!text) throw new Error("Empty response from OpenRouter")
  return text
}
