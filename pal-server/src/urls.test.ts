import assert from "node:assert/strict";
import { test } from "node:test";
import { parseSupportedUrl, unsupportedUrlMessage } from "./urls.js";

test("accepts supported reel/video/short URLs", () => {
  assert.equal(parseSupportedUrl("https://www.instagram.com/reel/C1abc_-9/?igsh=xyz")?.platform, "instagram");
  assert.equal(parseSupportedUrl("https://www.tiktok.com/@stealth_health/video/7312345678901234567")?.platform, "tiktok");
  assert.equal(parseSupportedUrl("https://youtube.com/shorts/abc123XYZ_-")?.platform, "youtube");
  assert.equal(parseSupportedUrl("https://www.instagram.com/reel/C1abc/?igsh=x")?.url, "https://www.instagram.com/reel/C1abc/");
});

test("rejects everything else", () => {
  for (const bad of [
    "https://www.youtube.com/watch?v=abc",
    "https://www.instagram.com/p/C1abc/",
    "https://www.tiktok.com/@user",
    "https://evil.com/reel/abc",
    "https://instagram.com.evil.com/reel/abc",
    "ftp://instagram.com/reel/abc",
    "not a url",
    "",
    42,
    null,
  ]) {
    assert.equal(parseSupportedUrl(bad), null, String(bad));
  }
});

test("error message lists the patterns and echoes what was received", () => {
  const m = unsupportedUrlMessage("https://example.com/x");
  assert.match(m, /instagram\.com\/reel\/\*/);
  assert.match(m, /tiktok\.com\/@\*\/video\/\*/);
  assert.match(m, /youtube\.com\/shorts\/\*/);
  assert.match(m, /Received: https:\/\/example\.com\/x/);
});
