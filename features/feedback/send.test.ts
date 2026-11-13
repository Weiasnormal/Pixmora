import { describe, expect, it, vi } from "vitest";
import { escapeHtml, feedbackEmail, sendFeedback, templateVariables, validateFeedback } from "./send";

const env = { apiKey: "test-key", to: "owner@example.com" };

describe("validateFeedback", () => {
  it("needs a message", () => {
    expect(validateFeedback({ message: "   " })).toMatchObject({ ok: false, status: 400 });
  });

  it("rejects a bad email but allows none", () => {
    expect(validateFeedback({ message: "Hi", email: "nope" })).toMatchObject({ ok: false });
    expect(validateFeedback({ message: "Hi", email: "" })).toMatchObject({ ok: true });
  });

  it("only takes 1 to 5 stars", () => {
    expect(validateFeedback({ message: "Hi", rating: 6 })).toMatchObject({ ok: false });
    expect(validateFeedback({ message: "Hi", rating: 4 })).toMatchObject({
      ok: true,
      value: { rating: 4 },
    });
    expect(validateFeedback({ message: "Hi" })).toMatchObject({ ok: true, value: { rating: null } });
  });
});

describe("sendFeedback", () => {
  const feedback = { rating: 5, message: "Love the sheet tabs", email: "a@b.co", context: "/studio" };

  it("says when feedback isn't set up", async () => {
    const fetchImpl = vi.fn();
    expect(await sendFeedback(feedback, {}, fetchImpl)).toMatchObject({ ok: false, status: 503 });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("emails the owner through Resend, replying to the sender", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    expect(await sendFeedback(feedback, env, fetchImpl)).toEqual({ ok: true, value: null });

    const [url, init] = fetchImpl.mock.calls[0];
    const body = JSON.parse(init.body);
    expect(url).toBe("https://api.resend.com/emails");
    expect(init.headers.Authorization).toBe("Bearer test-key");
    expect(body.to).toEqual(["owner@example.com"]);
    expect(body.reply_to).toBe("a@b.co");
    expect(body.subject).toBe("Pixmora feedback: 5/5");
    expect(body.text).toContain("Love the sheet tabs");
  });

  it("reports a Resend failure without crashing", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const fetchImpl = vi.fn().mockResolvedValue(new Response("bad", { status: 422 }));
    expect(await sendFeedback(feedback, env, fetchImpl)).toMatchObject({ ok: false, status: 502 });
  });

  it("never passes Resend's own words on to the person sending feedback", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const reason = '{"message":"You can only send testing emails to your own email address (owner@example.com)"}';
    const fetchImpl = vi.fn().mockResolvedValue(new Response(reason, { status: 403 }));
    const result = await sendFeedback(feedback, env, fetchImpl);
    expect(result).toEqual({
      ok: false,
      status: 502,
      error: "Your feedback couldn't be sent. Try again in a minute.",
    });
  });
});

describe("sending through the Resend template", () => {
  const feedback = { rating: 4, message: "<b>Nice</b> & quick", email: "", context: "/studio" };
  const withTemplate = { ...env, templateId: "tmpl_123" };

  it("sends the template with its variables and no plain text", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    expect(await sendFeedback(feedback, withTemplate, fetchImpl)).toEqual({ ok: true, value: null });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const body = JSON.parse(fetchImpl.mock.calls[0][1].body);
    expect(body.template.id).toBe("tmpl_123");
    expect(body.template.variables).toEqual({
      RATING_STARS: "★★★★☆",
      RATING: "4/5",
      MESSAGE: "&lt;b&gt;Nice&lt;/b&gt; &amp; quick",
      REPLY_TO: "No email given",
      CONTEXT: "/studio",
    });
    expect(body.text).toBeUndefined();
    expect(body.html).toBeUndefined();
    expect(body.reply_to).toBeUndefined();
  });

  it("falls back to plain text when the template is refused", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response("template not published", { status: 422 }))
      .mockResolvedValueOnce(new Response("{}", { status: 200 }));
    expect(await sendFeedback(feedback, withTemplate, fetchImpl)).toEqual({ ok: true, value: null });

    const second = JSON.parse(fetchImpl.mock.calls[1][1].body);
    expect(second.template).toBeUndefined();
    expect(second.text).toContain("<b>Nice</b> & quick");
  });

  it("escapes every character that could start HTML", () => {
    expect(escapeHtml(`<a href="x">'hi'</a>`)).toBe(
      "&lt;a href=&quot;x&quot;&gt;&#39;hi&#39;&lt;/a&gt;",
    );
    expect(templateVariables({ rating: null, message: "m", email: "", context: "" }).RATING).toBe(
      "No rating",
    );
  });
});

describe("feedbackEmail", () => {
  it("shows stars and says when no email was given", () => {
    const { text } = feedbackEmail({ rating: 3, message: "Ok", email: "", context: "" });
    expect(text).toContain("★★★☆☆ (3/5)");
    expect(text).toContain("No email given");
  });
});
