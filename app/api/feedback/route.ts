import { sendFeedback, validateFeedback } from "@/features/feedback/send";

const BODY_LIMIT = 10_000;
const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 5;

/** Best effort per server instance: enough to stop one person flooding the inbox. */
const recent = new Map<string, number[]>();

function tooMany(sender: string, now: number): boolean {
  const times = (recent.get(sender) ?? []).filter((time) => now - time < WINDOW_MS);
  if (times.length >= MAX_PER_WINDOW) {
    recent.set(sender, times);
    return true;
  }
  recent.set(sender, [...times, now]);
  return false;
}

export async function POST(request: Request) {
  const raw = await request.text();
  if (raw.length > BODY_LIMIT) {
    return Response.json({ error: "That message is too long." }, { status: 413 });
  }
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(raw);
  } catch {
    return Response.json({ error: "That request couldn't be read." }, { status: 400 });
  }

  // Bots fill the hidden field; they get a quiet success and nothing is sent.
  if (typeof body.website === "string" && body.website.trim() !== "") {
    return Response.json({ ok: true });
  }

  const parsed = validateFeedback(body);
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: parsed.status });

  // Only messages that would really be emailed count, so a typo never locks someone out.
  const sender = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (tooMany(sender, Date.now())) {
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
