import type { NextFunction, Request, Response } from "express";

// Tiny per-IP limiter so the public endpoints can't be used to flood the sheet. In memory, resets on restart.
export function limit(max: number, windowMs = 60_000) {
  const hits = new Map<string, { n: number; reset: number }>();
  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    const key = req.ip ?? "unknown";
    const h = hits.get(key);
    if (!h || h.reset < now) hits.set(key, { n: 1, reset: now + windowMs });
    else if (++h.n > max) return res.status(429).json({ error: "slow_down", message: "Whoa, too fast. Try again in a minute." });
    if (hits.size > 5000) for (const [k, v] of hits) if (v.reset < now) hits.delete(k);
    next();
  };
}
