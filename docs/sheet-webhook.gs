/**
 * ScrollPal sheet webhook (Google Apps Script).
 * Visitors never see this sheet. The API sends it one row per "yes" and one row per feedback answer.
 *
 * Setup (3 minutes), see DEPLOY.md "Hidden Google Sheet":
 *   1. Open the sheet -> Extensions -> Apps Script -> paste this file -> set SECRET below.
 *   2. Run `setup` once (it asks for permission, then creates the tabs).
 *   3. Deploy -> New deployment -> type "Web app" -> Execute as: Me -> Who has access: Anyone -> Deploy.
 *   4. Copy the web app URL into the GitHub secret SHEET_WEBHOOK_URL, and SECRET into SHEET_SECRET.
 */
const SECRET = "CHANGE-ME-to-a-long-random-string";

const TABS = {
  Pals: ["Time", "Came from", "On a phone"],
  Feedback: ["Time", "Device", "Moment", "Level", "Cooks", "Question id", "Pal asked", "They said"],
};

function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  Object.keys(TABS).forEach((name) => {
    const sh = ss.getSheetByName(name) || ss.insertSheet(name);
    if (sh.getLastRow() === 0) {
      sh.appendRow(TABS[name]);
      sh.getRange(1, 1, 1, TABS[name].length).setFontWeight("bold");
      sh.setFrozenRows(1);
    }
  });
  const sum = ss.getSheetByName("Summary") || ss.insertSheet("Summary", 0);
  sum.clear();
  sum.getRange("A1:B4").setValues([
    ["Pals (people who said yes)", "=MAX(0,COUNTA(Pals!A:A)-1)"],
    ["Feedback answers", "=MAX(0,COUNTA(Feedback!A:A)-1)"],
    ["Phones who said yes", '=COUNTIF(Pals!C:C,TRUE)+COUNTIF(Pals!C:C,"true")'],
    ["Updated", "=NOW()"],
  ]);
  sum.getRange("A1:A4").setFontWeight("bold");
  sum.setColumnWidth(1, 240);
}

function doPost(e) {
  let body;
  try { body = JSON.parse(e.postData.contents); } catch (err) { return out({ ok: false, error: "bad json" }); }
  if (body.secret !== SECRET) return out({ ok: false, error: "no" });

  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    if (body.kind === "pal_yes") {
      ss.getSheetByName("Pals").appendRow([body.ts, body.ref, body.mobile]);
    } else if (body.kind === "feedback") {
      const moment = body.milestone === "1" ? "after 1st cook" : body.milestone === "3" ? "after 3rd cook" : "from the Pal tab";
      ss.getSheetByName("Feedback").appendRow([body.ts, body.device, moment, body.level, body.cooks, body.id, body.q, body.a]);
    } else {
      return out({ ok: false, error: "unknown kind" });
    }
    return out({ ok: true });
  } finally {
    lock.releaseLock();
  }
}

function out(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
