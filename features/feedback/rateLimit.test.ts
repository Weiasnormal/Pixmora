import { describe, expect, it } from "vitest";
import { createRateLimiter } from "./rateLimit";

const MINUTE = 60_000;

describe("createRateLimiter", () => {
  it("allows a few messages, then stops the sender until the window passes", () => {
    const limiter = createRateLimiter({ windowMs: 10 * MINUTE, maxPerWindow: 2 });
    expect(limiter.tooMany("a", 0)).toBe(false);
    expect(limiter.tooMany("a", MINUTE)).toBe(false);
    expect(limiter.tooMany("a", 2 * MINUTE)).toBe(true);
    expect(limiter.tooMany("b", 2 * MINUTE)).toBe(false);
    expect(limiter.tooMany("a", 11 * MINUTE)).toBe(false);
  });

  it("forgets senders once their messages are older than the window", () => {
    const limiter = createRateLimiter({ windowMs: 10 * MINUTE, maxPerWindow: 5 });
    for (let index = 0; index < 100; index += 1) limiter.tooMany(`sender-${index}`, 0);
    expect(limiter.size()).toBe(100);
    limiter.tooMany("later", 20 * MINUTE);
    expect(limiter.size()).toBe(1);
  });

  it("never keeps more senders than the cap, dropping the least recent first", () => {
    const limiter = createRateLimiter({ windowMs: 10 * MINUTE, maxPerWindow: 1, maxSenders: 3 });
    limiter.tooMany("a", 0);
    limiter.tooMany("b", 1);
    limiter.tooMany("c", 2);
    limiter.tooMany("a", 3); // still blocked, and now the most recent
    limiter.tooMany("d", 4); // pushes out "b", the least recent
    expect(limiter.size()).toBe(3);
    expect(limiter.tooMany("a", 5)).toBe(true);
    expect(limiter.tooMany("b", 6)).toBe(false);
  });
});
