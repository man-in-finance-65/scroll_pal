// Pods, goals and dishes in SurrealDB: one table each (schema in db/schema.surql).
import { RecordId, type Surreal } from "surrealdb";
import type { Goal } from "../../engine/swap.ts";
import type { Member, Pod, PodState, PodStore, StoredDish } from "../../engine/pods.ts";

type PodRow = { code: string; name: string; members: Member[]; receiptTotal?: number | null; instacartUrl?: string | null };
const key = (podId: string, userId: string) => `${podId}__${userId}`;

export class SurrealPodStore implements PodStore {
  db: Surreal;
  constructor(db: Surreal) { this.db = db; }

  private toPod(id: string, row: PodRow): Pod {
    return { id, code: row.code, name: row.name, members: row.members ?? [], receiptTotal: row.receiptTotal ?? null, instacartUrl: row.instacartUrl ?? null };
  }

  async create(pod: Pod) {
    const { id, ...row } = pod;
    await this.db.create(new RecordId("pod", id)).content(row);
  }

  async load(podId: string): Promise<PodState | null> {
    const [pods, goals, dishes] = await this.db
      .query<[PodRow[], { user: string; goal: Goal }[], { user: string; dish: StoredDish }[]]>(
        "SELECT * FROM ONLY $pod; SELECT user, goal FROM goal WHERE pod = $pod; SELECT user, dish FROM dish WHERE pod = $pod;",
        { pod: new RecordId("pod", podId) },
      )
      .json()
      .collect();
    const row = pods as unknown as PodRow | null;
    if (!row) return null;
    return {
      pod: this.toPod(podId, row),
      goals: Object.fromEntries(goals.map((g) => [g.user, g.goal])),
      dishes: Object.fromEntries(dishes.map((d) => [d.user, d.dish])),
    };
  }

  async findByCode(code: string) {
    const [rows] = await this.db.query<[(PodRow & { id: string })[]]>("SELECT *, record::id(id) AS id FROM pod WHERE code = $code LIMIT 1", { code }).json().collect();
    return rows[0] ? this.toPod(rows[0].id, rows[0]) : null;
  }

  async listForUser(userId: string) {
    const [rows] = await this.db.query<[(PodRow & { id: string })[]]>("SELECT *, record::id(id) AS id FROM pod WHERE members.userId CONTAINS $user", { user: userId }).json().collect();
    return rows.map((r) => this.toPod(r.id, r));
  }

  async saveMembers(podId: string, members: Member[]) {
    await this.db.update(new RecordId("pod", podId)).merge({ members });
  }

  async savePodFields(podId: string, fields: Partial<Pick<Pod, "receiptTotal" | "instacartUrl">>) {
    await this.db.update(new RecordId("pod", podId)).merge(fields);
  }

  async saveGoal(podId: string, userId: string, goal: Goal) {
    await this.db.upsert(new RecordId("goal", key(podId, userId))).content({ pod: new RecordId("pod", podId), user: userId, goal });
  }

  async saveDish(podId: string, userId: string, dish: StoredDish) {
    await this.db.upsert(new RecordId("dish", key(podId, userId))).content({ pod: new RecordId("pod", podId), user: userId, dish });
  }
}
