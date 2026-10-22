import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { canonicalName, costSplit, dishPhases, goalConflicts, groceryList, prepSheet, toBase, type Dish, type PriceTable } from "./swap.ts";
import { MemoryPodStore, PodError, SAMPLE_DISHES, joinPod, createPod, seedDemoPod, setGoal, setReceipt, submitDish, viewPod } from "./pods.ts";

const PRICES: PriceTable = JSON.parse(readFileSync("data/prices.json", "utf8"));
const { tikka, chili, pesto } = SAMPLE_DISHES;

// Goals
test("high-protein flags a dish under the per-meal minimum", () => {
  assert.deepEqual(goalConflicts(pesto, { kind: "high-protein", minProteinG: 30 }), ["21 g protein per portion, goal is 30 g+"]);
  assert.deepEqual(goalConflicts(tikka, { kind: "high-protein", minProteinG: 30 }), []);
});
test("calorie target flags a portion over 115% of one meal's share", () => {
  const goal = { kind: "calorie-target", dailyKcal: 1800, mealsPerDay: 3 } as const; // 600 per meal, flag above 690
  assert.equal(goalConflicts(pesto, goal).length, 0); // 690 is exactly the limit
  assert.equal(goalConflicts({ ...pesto, macros: { ...pesto.macros, kcal: 700 } }, goal).length, 1);
});
test("vegetarian flags meat and fish by ingredient name", () => {
  assert.deepEqual(goalConflicts(chili, { kind: "vegetarian" }), ["contains ground turkey"]);
  assert.deepEqual(goalConflicts(pesto, { kind: "vegetarian" }), []);
});
test("low-carb flags high-carb portions", () => assert.equal(goalConflicts(pesto, { kind: "low-carb", maxCarbsG: 40 }).length, 1));

// Grocery list
test("units convert to grams, millilitres or a count", () => {
  assert.deepEqual(toBase(2, "tbsp"), { qty: 29.58, base: "ml" });
  assert.deepEqual(toBase(1, "lb"), { qty: 453.6, base: "g" });
  assert.deepEqual(toBase(3, "cloves"), { qty: 3, base: "count" });
});
test("ingredient names match the price table through aliases and plurals", () => {
  assert.equal(canonicalName("Garlic cloves, minced", PRICES), "garlic");
  assert.equal(canonicalName("Large eggs", PRICES), "egg");
  assert.equal(canonicalName("boneless chicken breasts", PRICES), "chicken breast");
});
test("each dish is scaled to 9 portions and duplicates merge", () => {
  const list = groceryList([tikka, chili, pesto], PRICES);
  const garlic = list.find((l) => l.name === "garlic")!;
  assert.equal(garlic.qty, 27); // 1 clove x 9 portions x 3 dishes
  assert.equal(garlic.dishes.length, 3);
  assert.equal(list.find((l) => l.name === "chicken breast")!.qty, 1350); // 150 g x 9
  assert.equal(list.filter((l) => l.name === "onion").length, 1);
});
test("cups of rice merge with grams through the price table's density", () => {
  const a: Dish = { ...tikka, ingredients: [{ name: "rice", qty: 1, unit: "cup" }] };
  const b: Dish = { ...chili, ingredients: [{ name: "white rice", qty: 100, unit: "g" }] };
  const rice = groceryList([a, b], PRICES).filter((l) => l.name === "white rice");
  assert.equal(rice.length, 1);
  assert.equal(Math.round(rice[0].qty), 240 * 0.85 * 9 + 900);
});
test("unknown ingredients stay on the list without a price", () => {
  const odd: Dish = { ...pesto, ingredients: [{ name: "dragonfruit", qty: 50, unit: "g" }] };
  const split = costSplit(groceryList([odd], PRICES), null, "CAD");
  assert.deepEqual(split.unpriced, ["dragonfruit"]);
});

// Cost split
test("cost split: ingredients plus 27 portions at the chef's rate, divided by 3 to the cent", () => {
  const list = groceryList([tikka, chili, pesto], PRICES);
  const split = costSplit(list, { id: "x", name: "X", ratePerPortion: 3.5, bio: "", specialty: "" }, "CAD");
  assert.equal(split.chef, 94.5); // 27 x 3.50
  assert.equal(Math.round((split.perMember[0] + split.perMember[1] + split.perMember[2]) * 100), Math.round(split.total * 100));
  const cents = split.perMember.map((n) => Math.round(n * 100));
  assert.ok(Math.max(...cents) - Math.min(...cents) <= 1);
});

// Prep sheet
test("prep sheet never schedules a step before an earlier step of the same dish", () => {
  for (const d of [tikka, chili, pesto]) {
    const sheet = prepSheet([tikka, chili, pesto], PRICES).filter((s) => s.dish === d.name && !/^(Dice|Chop|Halve)/.test(s.text));
    const order = sheet.map((s) => d.steps.findIndex((t) => s.text.startsWith(t)));
    assert.deepEqual(order, [...order].sort((x, y) => x - y), d.name);
  }
});
test("browning before a simmer joins the long cook", () => {
  assert.deepEqual(dishPhases(chili.steps), ["Prep", "Start the long cooks", "Start the long cooks", "Finish and portion"]);
});
test("prep sheet starts with set-up and ends with portioning 27 containers", () => {
  const sheet = prepSheet([tikka, chili, pesto], PRICES);
  assert.equal(sheet[0].phase, "Set up");
  assert.match(sheet.at(-1)!.text, /Each member takes 3 of every dish/);
});

// Pods
test("pods hold 3 people; the 4th is turned away", async () => {
  const store = new MemoryPodStore();
  const pod = await createPod(store, { userId: "a", name: "A" }, "Test");
  await joinPod(store, { userId: "b", name: "B" }, pod.code.toLowerCase());
  await joinPod(store, { userId: "c", name: "C" }, pod.code);
  await assert.rejects(joinPod(store, { userId: "d", name: "D" }, pod.code), (e: PodError) => e.status === 409);
  await assert.rejects(joinPod(store, { userId: "d", name: "D" }, "NOPE00"), (e: PodError) => e.status === 404);
});
test("non-members can't read or write a pod", async () => {
  const store = new MemoryPodStore();
  const pod = await createPod(store, { userId: "a", name: "A" }, "Test");
  await assert.rejects(viewPod(store, pod.id, "x", PRICES), (e: PodError) => e.status === 403);
  await assert.rejects(setGoal(store, pod.id, "x", { kind: "vegetarian" }), (e: PodError) => e.status === 403);
});
test("bad goals are rejected", async () => {
  const store = new MemoryPodStore();
  const pod = await createPod(store, { userId: "a", name: "A" }, "Test");
  await assert.rejects(setGoal(store, pod.id, "a", { kind: "high-protein", minProteinG: -5 }));
});
test("a receipt total replaces the estimate and splits to the cent", () => {
  const split = costSplit(groceryList([tikka, chili, pesto], PRICES), null, "CAD", 100);
  assert.equal(split.source, "receipt");
  assert.deepEqual(split.perMember, [33.34, 33.33, 33.33]);
});
test("demo pod: a goal and a dish complete the swap; a receipt makes the split real", async () => {
  const store = new MemoryPodStore();
  const pod = await seedDemoPod(store, { userId: "me", name: "Me" });
  let view = await viewPod(store, pod.id, "me", PRICES);
  assert.equal(view.complete, false);
  await setGoal(store, pod.id, "me", { kind: "vegetarian" });
  await submitDish(store, pod.id, "me", pesto, { kind: "sample" });
  view = await viewPod(store, pod.id, "me", PRICES);
  assert.equal(view.complete, true);
  assert.equal(view.swap!.cost.source, "estimate");
  assert.equal(view.swap!.cost.chef, 0); // creator chefs are coming soon
  await setReceipt(store, pod.id, "me", 91.2);
  assert.equal((await viewPod(store, pod.id, "me", PRICES)).swap!.cost.total, 91.2);
  await assert.rejects(setReceipt(store, pod.id, "me", -3));
  assert.equal(view.swap!.totalPortions, 27);
  assert.equal(view.swap!.mealsPerMember, 9);
  assert.ok(view.dishes.find((d) => d.name === pesto.name)!.conflicts.some((c) => c.member === "Maya"));
});
