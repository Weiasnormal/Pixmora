/**
 * A small per-server rate limit for the feedback form. It is best effort: each server
 * instance keeps its own count, which is enough to stop one person flooding the inbox.
 * Old senders are forgotten, and the list has a hard cap, so memory stays bounded even
 * when requests come from many different addresses.
 */
export type RateLimiter = { tooMany: (sender: string, now: number) => boolean; size: () => number };

export function createRateLimiter({
  windowMs,
  maxPerWindow,
  maxSenders = 5_000,
}: {
  windowMs: number;
  maxPerWindow: number;
  maxSenders?: number;
}): RateLimiter {
  const recent = new Map<string, number[]>();
  let lastSweep = 0;

  /** Drops senders whose last message is older than the window. At most once per window. */
  function sweep(now: number) {
    if (now - lastSweep < windowMs) return;
    lastSweep = now;
    for (const [sender, times] of recent) {
      if (now - times[times.length - 1] >= windowMs) recent.delete(sender);
    }
  }

  return {
    tooMany(sender, now) {
      sweep(now);
      const times = (recent.get(sender) ?? []).filter((time) => now - time < windowMs);
      // Re-inserting keeps the Map in order of last activity, oldest first.
      recent.delete(sender);
      if (times.length >= maxPerWindow) {
        recent.set(sender, times);
        return true;
      }
      recent.set(sender, [...times, now]);
      // Past the cap, the least recently active senders are forgotten first.
      for (const oldest of recent.keys()) {
        if (recent.size <= maxSenders) break;
        recent.delete(oldest);
      }
      return false;
    },
    size: () => recent.size,
  };
}
