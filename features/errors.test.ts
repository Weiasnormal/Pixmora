import { describe, expect, it, vi } from "vitest";
import { FriendlyError, friendlyMessage } from "./errors";

describe("friendlyMessage", () => {
  it("shows messages written for people", () => {
    expect(friendlyMessage(new FriendlyError("A photo is missing."), "Fallback")).toBe(
      "A photo is missing.",
    );
  });

  it("hides technical errors behind the fallback", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(friendlyMessage(new TypeError("Cannot read properties of undefined"), "Fallback")).toBe(
      "Fallback",
    );
    expect(friendlyMessage("raw string", "Fallback")).toBe("Fallback");
  });
});
