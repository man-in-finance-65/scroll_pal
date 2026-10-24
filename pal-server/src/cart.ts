import { z } from "zod";

// What is real here (checked 2026-10-24):
// - Instacart has an official API (Developer Platform) that turns a list into a shopping-list page.
//   It needs an approved key (INSTACART_API_KEY). Without one we open Instacart.ca's search instead.
// - DoorDash and Costco have no public API for carts or prices, so they only get a website search link.
// - No store returns prices to us, so `prices` is always null and the app says prices are unavailable.

export const Store = z.enum(["instacart", "costco", "doordash"]);
export type Store = z.infer<typeof Store>;

export const CartRequest = z.object({
  store: Store,
  items: z
    .array(z.object({ name: z.string().min(1), quantity: z.number().positive().nullable(), unit: z.string() }))
    .min(1, "the shopping list is empty"),
  title: z.string().min(1).default("Pal shopping list"),
});
export type CartRequest = z.infer<typeof CartRequest>;

const SEARCH: Record<Store, (q: string) => string> = {
  instacart: (q) => `https://www.instacart.ca/store/s?k=${encodeURIComponent(q)}`,
  costco: (q) => `https://www.costco.ca/s?keyword=${encodeURIComponent(q)}`,
  doordash: (q) => `https://www.doordash.com/search/store/${encodeURIComponent(q)}/`,
};
const LABEL: Record<Store, string> = { instacart: "Instacart", costco: "Costco", doordash: "DoorDash" };

export type CartResult = {
  store: Store;
  /** "list_link" = one link with every item (real Instacart API); "search_links" = one store search per item. */
  mode: "list_link" | "search_links";
  list_url: string | null;
  items: { name: string; search_url: string }[];
  prices: null;
  note: string;
};

const IDP_URL = "https://connect.instacart.com/idp/v1/products/products_link";

export async function buildCart(req: CartRequest, instacartKey: string | undefined, fetchImpl: typeof fetch = fetch): Promise<CartResult> {
  const items = req.items.map((i) => ({ name: i.name, search_url: SEARCH[req.store](i.name) }));
  const base = { store: req.store, items, prices: null };
  if (req.store !== "instacart" || !instacartKey) {
    return {
      ...base,
      mode: "search_links",
      list_url: null,
      note:
        req.store === "instacart"
          ? "Pal has no Instacart API key yet, so each item opens Instacart.ca's search. Prices are not available."
          : `${LABEL[req.store]} has no public cart API, so each item opens ${LABEL[req.store]}'s search. Prices are not available.`,
    };
  }
  const res = await fetchImpl(IDP_URL, {
    method: "POST",
    headers: { authorization: `Bearer ${instacartKey}`, "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      title: req.title,
      link_type: "shopping_list",
      line_items: req.items.map((i) => ({
        name: i.name,
        ...(i.quantity ? { line_item_measurements: [{ quantity: i.quantity, unit: i.unit || "each" }] } : {}),
      })),
    }),
  });
  if (!res.ok) throw new Error(`Instacart API returned ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const j = (await res.json()) as { products_link_url?: string };
  if (!j.products_link_url) throw new Error(`Instacart API response had no products_link_url: ${JSON.stringify(j).slice(0, 300)}`);
  return {
    ...base,
    mode: "list_link",
    list_url: j.products_link_url,
    note: "Instacart made this shopping list. Pick a store there. Instacart does not share prices with Pal.",
  };
}
