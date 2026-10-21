// Pods: three people, three dishes, one chef. The same code runs on the server (SurrealDB)
// and inside the app's demo mode (in memory), so both behave identically.
import { computeSwap, goalConflicts, MEMBERS_PER_POD, type Chef, type Dish, type Goal, type PriceTable, type Swap } from "./swap.ts";

export type Member = { userId: string; name: string };
export type DishSource = { kind: "reel"; url: string; caption: string } | { kind: "screenshot" } | { kind: "sample" };
export type StoredDish = Dish & { memberId: string; source: DishSource };
export type Pod = { id: string; code: string; name: string; members: Member[]; votes: Record<string, string> };
export type PodState = { pod: Pod; goals: Record<string, Goal>; dishes: Record<string, StoredDish> };

export interface PodStore {
  create(pod: Pod): Promise<void>;
  load(podId: string): Promise<PodState | null>;
  findByCode(code: string): Promise<Pod | null>;
  listForUser(userId: string): Promise<Pod[]>;
  saveMembers(podId: string, members: Member[]): Promise<void>;
  saveVotes(podId: string, votes: Record<string, string>): Promise<void>;
  saveGoal(podId: string, userId: string, goal: Goal): Promise<void>;
  saveDish(podId: string, userId: string, dish: StoredDish): Promise<void>;
}

export class PodError extends Error {
  status: 400 | 403 | 404 | 409;
  constructor(message: string, status: 400 | 403 | 404 | 409 = 400) { super(message); this.status = status; }
}

// ---------- Seed data ----------

export const CHEFS: Chef[] = [
  { id: "chef-amara", name: "Chef Amara", ratePerPortion: 3.5, specialty: "High-protein batch cooking", bio: "Cooks for two Toronto run clubs every Sunday. Fast, tidy, big on spice." },
  { id: "chef-luca", name: "Chef Luca", ratePerPortion: 4.0, specialty: "Italian comfort, made lighter", bio: "Ex-restaurant line cook. Knows how to hold pasta and sauces for five days." },
  { id: "chef-priya", name: "Chef Priya", ratePerPortion: 3.0, specialty: "Vegetarian and curries", bio: "Plant-forward meal prep for students and shift workers." },
];

// Sample dishes in the same shape Claude returns. Macros are rough per-serving estimates for the demo.
export const SAMPLE_DISHES: Record<string, Dish> = {
  tikka: {
    name: "Chicken Tikka Rice Bowls",
    ingredients: [
      { name: "chicken breast", qty: 150, unit: "g" }, { name: "greek yogurt", qty: 40, unit: "g" }, { name: "tikka masala paste", qty: 1, unit: "tbsp" },
      { name: "white rice", qty: 0.33, unit: "cup" }, { name: "onion", qty: 0.25, unit: "" }, { name: "garlic", qty: 1, unit: "clove" }, { name: "cilantro", qty: 3, unit: "g" },
    ],
    steps: ["Dice the chicken and mix with yogurt and tikka paste; marinate 15 minutes.", "Cook the rice for 15 minutes.", "Sear the chicken with onion and garlic until browned.", "Divide rice and chicken into containers and garnish with cilantro."],
    macros: { kcal: 520, proteinG: 46, carbsG: 52, fatG: 11 },
  },
  chili: {
    name: "Turkey & Black Bean Chili",
    ingredients: [
      { name: "ground turkey", qty: 120, unit: "g" }, { name: "black beans", qty: 80, unit: "g" }, { name: "crushed tomatoes", qty: 0.5, unit: "cup" },
      { name: "onion", qty: 0.25, unit: "" }, { name: "garlic", qty: 1, unit: "clove" }, { name: "bell pepper", qty: 0.33, unit: "" }, { name: "chili powder", qty: 1, unit: "tsp" },
    ],
    steps: ["Chop the onion, garlic and bell pepper.", "Brown the turkey with the onion and garlic.", "Add beans, tomatoes, pepper and chili powder and simmer 30 minutes.", "Cool, then portion into containers."],
    macros: { kcal: 410, proteinG: 34, carbsG: 32, fatG: 14 },
  },
  pesto: {
    name: "Creamy Pesto Pasta with Cherry Tomatoes",
    ingredients: [
      { name: "pasta", qty: 100, unit: "g" }, { name: "basil pesto", qty: 2, unit: "tbsp" }, { name: "heavy cream", qty: 3, unit: "tbsp" },
      { name: "cherry tomatoes", qty: 80, unit: "g" }, { name: "parmesan", qty: 15, unit: "g" }, { name: "garlic", qty: 1, unit: "clove" },
    ],
    steps: ["Boil the pasta for 10 minutes.", "Halve the cherry tomatoes and mince the garlic.", "Heat the cream with pesto and garlic, then toss with the pasta and tomatoes.", "Top with parmesan and portion."],
    macros: { kcal: 690, proteinG: 21, carbsG: 78, fatG: 33 },
  },
};

const DEMO_MEMBERS: { member: Member; goal: Goal; dish: keyof typeof SAMPLE_DISHES; vote: string }[] = [
  { member: { userId: "demo-maya", name: "Maya" }, goal: { kind: "high-protein", minProteinG: 30 }, dish: "tikka", vote: "chef-amara" },
  { member: { userId: "demo-dev", name: "Dev" }, goal: { kind: "calorie-target", dailyKcal: 1800, mealsPerDay: 3 }, dish: "chili", vote: "chef-luca" },
];

// ---------- Service ----------

const CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no 0/O or 1/I/L
export const newCode = (rand = Math.random) => Array.from({ length: 6 }, () => CODE_CHARS[Math.floor(rand() * CODE_CHARS.length)]).join("");
const newId = (rand = Math.random) => `pod${Date.now().toString(36)}${Math.floor(rand() * 1e6).toString(36)}`;

export async function createPod(store: PodStore, user: Member, name: string): Promise<Pod> {
  const pod: Pod = { id: newId(), code: newCode(), name: name.trim() || `${user.name}'s pod`, members: [user], votes: {} };
  await store.create(pod);
  return pod;
}

export async function joinPod(store: PodStore, user: Member, code: string): Promise<Pod> {
  const pod = await store.findByCode(code.trim().toUpperCase());
  if (!pod) throw new PodError("No pod has that invite code. Check it with whoever sent it.", 404);
  if (pod.members.some((m) => m.userId === user.userId)) return pod;
  if (pod.members.length >= MEMBERS_PER_POD) throw new PodError("That pod already has 3 people.", 409);
  pod.members = [...pod.members, user];
  await store.saveMembers(pod.id, pod.members);
  return pod;
}

async function memberState(store: PodStore, podId: string, userId: string): Promise<PodState> {
  const state = await store.load(podId);
  if (!state) throw new PodError("Pod not found.", 404);
  if (!state.pod.members.some((m) => m.userId === userId)) throw new PodError("You're not in this pod.", 403);
  return state;
}

export function validateGoal(g: unknown): Goal {
  const x = g as Partial<Goal> & Record<string, unknown>;
  const pos = (n: unknown, max: number) => typeof n === "number" && n > 0 && n <= max;
  if (x?.kind === "high-protein" && pos(x.minProteinG, 150)) return { kind: "high-protein", minProteinG: x.minProteinG as number };
  if (x?.kind === "calorie-target" && pos(x.dailyKcal, 6000) && pos(x.mealsPerDay, 8)) return { kind: "calorie-target", dailyKcal: x.dailyKcal as number, mealsPerDay: x.mealsPerDay as number };
  if (x?.kind === "low-carb" && pos(x.maxCarbsG, 300)) return { kind: "low-carb", maxCarbsG: x.maxCarbsG as number };
  if (x?.kind === "vegetarian") return { kind: "vegetarian" };
  throw new PodError("Pick a goal and fill in its number.");
}

export async function setGoal(store: PodStore, podId: string, userId: string, goal: unknown) {
  await memberState(store, podId, userId);
  await store.saveGoal(podId, userId, validateGoal(goal));
}

export async function submitDish(store: PodStore, podId: string, userId: string, dish: Dish, source: DishSource) {
  await memberState(store, podId, userId);
  await store.saveDish(podId, userId, { ...dish, memberId: userId, source });
}

export async function vote(store: PodStore, podId: string, userId: string, chefId: string) {
  const { pod } = await memberState(store, podId, userId);
  if (!CHEFS.some((c) => c.id === chefId)) throw new PodError("Unknown chef.", 404);
  await store.saveVotes(podId, { ...pod.votes, [userId]: chefId });
}

export type DishView = StoredDish & { by: string; conflicts: { member: string; reasons: string[] }[] };
export type PodView = {
  pod: Pod;
  me: string;
  members: (Member & { goal: Goal | null; hasDish: boolean })[];
  dishes: DishView[];
  chefs: (Chef & { votes: number; votedByMe: boolean })[];
  chef: Chef | null;
  complete: boolean;
  swap: Swap | null;
};

// The chef is chosen once a majority (2 of 3) has voted for them.
export function selectedChef(votes: Record<string, string>): Chef | null {
  const counts = new Map<string, number>();
  for (const c of Object.values(votes)) counts.set(c, (counts.get(c) ?? 0) + 1);
  const winner = [...counts].find(([, n]) => n >= 2);
  return winner ? CHEFS.find((c) => c.id === winner[0]) ?? null : null;
}

export async function viewPod(store: PodStore, podId: string, userId: string, prices: PriceTable): Promise<PodView> {
  const { pod, goals, dishes } = await memberState(store, podId, userId);
  const nameOf = (id: string) => pod.members.find((m) => m.userId === id)?.name ?? "Someone";
  const dishViews: DishView[] = pod.members.filter((m) => dishes[m.userId]).map((m) => {
    const d = dishes[m.userId];
    const conflicts = pod.members
      .filter((x) => goals[x.userId])
      .map((x) => ({ member: x.name, reasons: goalConflicts(d, goals[x.userId]) }))
      .filter((c) => c.reasons.length);
    return { ...d, by: nameOf(m.userId), conflicts };
  });
  const chef = selectedChef(pod.votes);
  const complete = pod.members.length === MEMBERS_PER_POD && dishViews.length === MEMBERS_PER_POD;
  return {
    pod,
    me: userId,
    members: pod.members.map((m) => ({ ...m, goal: goals[m.userId] ?? null, hasDish: !!dishes[m.userId] })),
    dishes: dishViews,
    chefs: CHEFS.map((c) => ({ ...c, votes: Object.values(pod.votes).filter((v) => v === c.id).length, votedByMe: pod.votes[userId] === c.id })),
    chef,
    complete,
    swap: complete ? computeSwap(dishViews, prices, chef) : null,
  };
}

// A pod with two members already done (goals, dishes, one chef vote each), so a new user
// only has to set a goal, add a dish and cast the deciding vote.
export async function seedDemoPod(store: PodStore, user: Member): Promise<Pod> {
  const pod: Pod = { id: newId(), code: newCode(), name: "Sunday Swap (demo)", members: [...DEMO_MEMBERS.map((d) => d.member), user], votes: {} };
  await store.create(pod);
  for (const d of DEMO_MEMBERS) {
    await store.saveGoal(pod.id, d.member.userId, d.goal);
    await store.saveDish(pod.id, d.member.userId, { ...SAMPLE_DISHES[d.dish], memberId: d.member.userId, source: { kind: "sample" } });
  }
  await store.saveVotes(pod.id, Object.fromEntries(DEMO_MEMBERS.map((d) => [d.member.userId, d.vote])));
  return pod;
}

// ---------- In-memory store (tests, demo mode, and the API when no database is configured) ----------

export class MemoryPodStore implements PodStore {
  pods = new Map<string, PodState>();
  async create(pod: Pod) { this.pods.set(pod.id, { pod: structuredClone(pod), goals: {}, dishes: {} }); }
  async load(id: string) { const s = this.pods.get(id); return s ? structuredClone(s) : null; }
  async findByCode(code: string) { for (const s of this.pods.values()) if (s.pod.code === code) return structuredClone(s.pod); return null; }
  async listForUser(userId: string) { return [...this.pods.values()].filter((s) => s.pod.members.some((m) => m.userId === userId)).map((s) => structuredClone(s.pod)); }
  async saveMembers(id: string, members: Member[]) { this.pods.get(id)!.pod.members = structuredClone(members); }
  async saveVotes(id: string, votes: Record<string, string>) { this.pods.get(id)!.pod.votes = { ...votes }; }
  async saveGoal(id: string, userId: string, goal: Goal) { this.pods.get(id)!.goals[userId] = { ...goal }; }
  async saveDish(id: string, userId: string, dish: StoredDish) { this.pods.get(id)!.dishes[userId] = structuredClone(dish); }
}
