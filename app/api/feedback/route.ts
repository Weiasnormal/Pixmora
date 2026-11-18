import { createRateLimiter } from "@/features/feedback/rateLimit";
import { checkRequestSource, sendFeedback, validateFeedback } from "@/features/feedback/send";

const BODY_LIMIT = 10_000;

/** Five messages per sender in ten minutes, counted per server instance. */
const limiter = createRateLimiter({ windowMs: 10 * 60 * 1000, maxPerWindow: 5 });

export async function POST(request: Request) {
  const source = checkRequestSource(request.headers);
  if (!source.ok) return Response.json({ error: source.error }, { status: source.status });

  const raw = await request.text();
  if (raw.length > BODY_LIMIT) {
    return Response.json({ error: "That message is too long." }, { status: 413 });
  }
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return Response.json({ error: "That request couldn't be read." }, { status: 400 });
  }

  // `null`, a number or a list is a bad request, not a crash.
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return Response.json({ error: "That request couldn't be read." }, { status: 400 });
  }

  // Bots fill the hidden field; they get a quiet success and nothing is sent.
  const { website } = body as { website?: unknown };
  if (typeof website === "string" && website.trim() !== "") {
    return Response.json({ ok: true });
  }

  const parsed = validateFeedback(body);
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: parsed.status });

  // Only messages that would really be emailed count, so a typo never locks someone out.
  const sender = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (limiter.tooMany(sender, Date.now())) {
    return Response.json(
      { error: "You've sent a lot of feedback just now. Try again in a few minutes." },
      { status: 429 },
    );
  }

  const sent = await sendFeedback(parsed.value, {
    apiKey: process.env.RESEND_API_KEY,
    to: process.env.FEEDBACK_TO_EMAIL,
    from: process.env.FEEDBACK_FROM_EMAIL,
    templateId: process.env.RESEND_TEMPLATE_ID,
  });
  if (!sent.ok) return Response.json({ error: sent.error }, { status: sent.status });
  return Response.json({ ok: true });
}
