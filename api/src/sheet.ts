import { GoogleAuth, Impersonated } from "google-auth-library";

// The live tracker: one row per tap / answer, appended to a private Google Sheet.
// How the server is allowed in: the sheet is shared (as Editor) with this Cloud Run service's own Google account.
// Cloud Run's default login can't use the Sheets API directly, so we ask Google for a short Sheets-only pass for
// the same account (this is what the "serviceAccountTokenCreator" step in scripts/deploy-cloud-shell.sh allows).
// If SHEET_ID isn't set, nothing is written and rows only go to the logs.

export type Tab = "Pals" | "Events" | "Feedback";
const COLUMNS: Record<Tab, string> = { Pals: "A:C", Events: "A:D", Feedback: "A:H" };

// valueInputOption=RAW stores everything exactly as text, so a message like "=1+1" can never run as a formula.
const safe = (v: unknown) => String(v ?? "").slice(0, 2000);

// Google Sheets stores dates as "days since 1899-12-30". Writing a number keeps every time in UTC and sortable.
export const sheetTime = (ms = Date.now()) => ms / 86_400_000 + 25_569;

type TokenFn = () => Promise<string>;
let cached: { token: string; until: number } | null = null;
let getTokenImpl: TokenFn = async () => {
  if (cached && cached.until > Date.now() + 60_000) return cached.token;
  const auth = new GoogleAuth({ scopes: ["https://www.googleapis.com/auth/cloud-platform"] });
  const source = await auth.getClient();
  const email =
    process.env.SHEET_SERVICE_ACCOUNT ||
    (await (
      await fetch("http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/email", {
        headers: { "Metadata-Flavor": "Google" },
        signal: AbortSignal.timeout(3000),
      })
    ).text());
  const client = new Impersonated({
    sourceClient: source,
    targetPrincipal: email.trim(),
    lifetime: 3600,
    delegates: [],
    targetScopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  const { token } = await client.getAccessToken();
  if (!token) throw new Error("no sheets token");
  cached = { token, until: Date.now() + 50 * 60_000 };
  return token;
};
// For tests only.
export const _setTokenProvider = (fn: TokenFn) => { getTokenImpl = fn; };

const apiBase = () => process.env.SHEETS_API_BASE || "https://sheets.googleapis.com";

// Writes the next free row (OVERWRITE, not INSERT_ROWS: inserting rows would shift the tracker's formulas and lose
// the date format). Never throws: a sheet problem must never break the app. Returns true if it was saved.
export async function toSheet(tab: Tab, row: unknown[]): Promise<boolean> {
  const id = process.env.SHEET_ID;
  if (!id) return false;
  const values = [row.map((v) => (typeof v === "number" || typeof v === "boolean" ? v : safe(v)))];
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const token = await getTokenImpl();
      const url = `${apiBase()}/v4/spreadsheets/${id}/values/${encodeURIComponent(`${tab}!${COLUMNS[tab]}`)}:append?valueInputOption=RAW&insertDataOption=OVERWRITE`;
      const res = await fetch(url, {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({ values }),
        signal: AbortSignal.timeout(10_000),
      });
      if (res.ok) return true;
      const body = (await res.text()).slice(0, 300);
      console.warn(`sheet ${tab} attempt ${attempt}: HTTP ${res.status} ${body}`);
      if (res.status === 401) cached = null; // token went stale, get a new one
      if (res.status === 403 || res.status === 404) return false; // not shared / wrong id: retrying won't help
    } catch (e) {
      console.warn(`sheet ${tab} attempt ${attempt} failed: ${(e as Error).message}`);
      cached = null;
    }
  }
  return false;
}
