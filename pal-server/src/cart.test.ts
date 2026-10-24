import assert from "node:assert/strict";
import { test } from "node:test";
import { buildCart, CartRequest } from "./cart.js";

const req = CartRequest.parse({ store: "instacart", items: [{ name: "heavy cream", quantity: 0.5, unit: "cup" }, { name: "egg", quantity: null, unit: "" }] });

test("instacart without an API key falls back to instacart.ca search links", async () => {
  const r = await buildCart(req, undefined, async () => { throw new Error("must not call the network"); });
  assert.equal(r.mode, "search_links");
  assert.equal(r.items[0].search_url, "https://www.instacart.ca/store/s?k=heavy%20cream");
  assert.equal(r.prices, null);
});

test("instacart with a key calls the Developer Platform products_link API", async () => {
  let sent: any;
  const fake = (async (url: string, init: RequestInit) => {
    sent = { url, auth: (init.headers as any).authorization, body: JSON.parse(String(init.body)) };
    return new Response(JSON.stringify({ products_link_url: "https://www.instacart.com/store/shopping_lists/1" }));
  }) as typeof fetch;
  const r = await buildCart(req, "key123", fake);
  assert.equal(sent.url, "https://connect.instacart.com/idp/v1/products/products_link");
  assert.equal(sent.auth, "Bearer key123");
  assert.deepEqual(sent.body.line_items, [
    { name: "heavy cream", line_item_measurements: [{ quantity: 0.5, unit: "cup" }] },
    { name: "egg" },
  ]);
  assert.equal(r.mode, "list_link");
  assert.equal(r.list_url, "https://www.instacart.com/store/shopping_lists/1");
});

test("instacart API error is reported with its status", async () => {
  const fake = (async () => new Response("nope", { status: 403 })) as unknown as typeof fetch;
  await assert.rejects(buildCart(req, "k", fake), /Instacart API returned 403: nope/);
});
