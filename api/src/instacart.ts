// "Add to Instacart": we send the grocery list to Instacart's official Developer Platform API and get back
// a link to a ready-made shopping page. The user signs in on Instacart's own page; Pal never sees that login.
import type { GroceryLine } from "../../engine/swap.ts";
import { PodError } from "../../engine/pods.ts";

const UNIT: Record<string, string> = { g: "gram", ml: "milliliter", count: "each" };

export async function instacartLink(title: string, lines: GroceryLine[], opts: { apiKey: string; baseUrl: string }): Promise<string> {
  const res = await fetch(`${opts.baseUrl}/idp/v1/products/products_link`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json", authorization: `Bearer ${opts.apiKey}` },
    body: JSON.stringify({
      title,
      link_type: "shopping_list",
      line_items: lines.map((l) => ({
        name: l.name,
        display_text: `${l.base === "count" ? `${Math.ceil(l.qty)} ×` : l.display} ${l.name}`,
        line_item_measurements: [{ quantity: l.base === "count" ? Math.ceil(l.qty) : Math.round(l.qty), unit: UNIT[l.base] ?? "each" }],
      })),
    }),
  });
  const json = (await res.json().catch(() => ({}))) as { products_link_url?: string };
  if (!res.ok || !json.products_link_url) throw new PodError("Instacart didn't accept the list just now. Try again in a minute.");
  return json.products_link_url;
}
