// Sends one row to the team's private Google Sheet through a small Google Apps Script web app
// (see docs/sheet-webhook.gs). Visitors never see the sheet. If it isn't set up, rows only go to the logs.

type Kind = "pal_yes" | "feedback";

// A cell starting with = + - @ would run as a formula in Sheets. Defuse it.
const safe = (v: unknown) => {
  const s = String(v ?? "").slice(0, 2000);
  return /^[=+\-@]/.test(s) ? "'" + s : s;
};

export async function toSheet(kind: Kind, row: Record<string, unknown>): Promise<void> {
  const url = process.env.SHEET_WEBHOOK_URL;
  if (!url) return;
  const clean = Object.fromEntries(Object.entries(row).map(([k, v]) => [k, safe(v)]));
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "text/plain" }, // text/plain avoids a CORS preflight on Apps Script
      body: JSON.stringify({ secret: process.env.SHEET_SECRET ?? "", kind, ...clean }),
      signal: AbortSignal.timeout(10_000),
      redirect: "follow",
    });
    if (!res.ok) console.warn(`sheet ${kind} -> HTTP ${res.status}`);
  } catch (e) {
    console.warn(`sheet ${kind} failed: ${(e as Error).message}`);
  }
}
