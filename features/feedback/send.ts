/** Server-side feedback handling. Only the text a person typed is sent, never photos. */

export const MESSAGE_LIMIT = 2000;
const EMAIL_LIMIT = 200;
const CONTEXT_LIMIT = 500;
const RESEND_URL = "https://api.resend.com/emails";
const DEFAULT_FROM = "Pixmora feedback <onboarding@resend.dev>";

export type Feedback = {
  rating: number | null;
  message: string;
  email: string;
  context: string;
};

export type FeedbackEnv = {
  apiKey?: string;
  to?: string;
  from?: string;
  /** A published Resend template. Without one, a plain-text email is sent. */
  templateId?: string;
};

type Result<T> = { ok: true; value: T } | { ok: false; status: number; error: string };

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateFeedback(raw: unknown): Result<Feedback> {
  const input = (raw ?? {}) as Record<string, unknown>;
  const message = typeof input.message === "string" ? input.message.trim() : "";
  const email = typeof input.email === "string" ? input.email.trim() : "";
  const context = typeof input.context === "string" ? input.context.trim() : "";
  const rating = input.rating;

  if (!message) return { ok: false, status: 400, error: "Write a message first." };
  if (message.length > MESSAGE_LIMIT) {
    return { ok: false, status: 400, error: `Keep the message under ${MESSAGE_LIMIT} characters.` };
  }
  if (email && (email.length > EMAIL_LIMIT || !EMAIL_PATTERN.test(email))) {
    return { ok: false, status: 400, error: "That email doesn't look right. Check it, or leave it empty." };
  }
  const validRating =
    rating === null || rating === undefined
      ? null
      : Number.isInteger(rating) && (rating as number) >= 1 && (rating as number) <= 5
        ? (rating as number)
        : undefined;
  if (validRating === undefined) return { ok: false, status: 400, error: "Pick 1 to 5 stars." };

  return {
    ok: true,
    value: { rating: validRating, message, email, context: context.slice(0, CONTEXT_LIMIT) },
  };
}

function starsOf(rating: number | null): string {
  return rating ? `${"★".repeat(rating)}${"☆".repeat(5 - rating)}` : "☆☆☆☆☆";
}

/** Template variables go into HTML as they are, so anything a person typed is escaped first. */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Values for the Pixmora feedback template in Resend. Names match its variables. */
export function templateVariables(feedback: Feedback): Record<string, string> {
  return {
    RATING_STARS: starsOf(feedback.rating),
    RATING: feedback.rating ? `${feedback.rating}/5` : "No rating",
    MESSAGE: escapeHtml(feedback.message),
    REPLY_TO: escapeHtml(feedback.email || "No email given"),
    CONTEXT: escapeHtml(feedback.context || "No page details were shared."),
  };
}

export function feedbackEmail(feedback: Feedback) {
  const stars = feedback.rating ? `${starsOf(feedback.rating)} (${feedback.rating}/5)` : "No rating";
  const subject = feedback.rating
    ? `Pixmora feedback: ${feedback.rating}/5`
    : "Pixmora feedback";
  const text = [
    `Rating: ${stars}`,
    `Reply to: ${feedback.email || "No email given"}`,
    "",
    feedback.message,
    "",
    "---",
    feedback.context ? `Sent from: ${feedback.context}` : "No page details were shared.",
  ].join("\n");
  return { subject, text };
}

export async function sendFeedback(
  feedback: Feedback,
  env: FeedbackEnv,
  fetchImpl: typeof fetch = fetch,
): Promise<Result<null>> {
  if (!env.apiKey || !env.to) {
    return { ok: false, status: 503, error: "Feedback isn't set up yet. Try again later." };
  }
  const { subject, text } = feedbackEmail(feedback);
  const base = {
    from: env.from || DEFAULT_FROM,
    to: [env.to],
    subject,
    ...(feedback.email ? { reply_to: feedback.email } : {}),
  };
  const post = (body: object) =>
    fetchImpl(RESEND_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

  try {
    if (env.templateId) {
      const response = await post({
        ...base,
        template: { id: env.templateId, variables: templateVariables(feedback) },
      });
      if (response.ok) return { ok: true, value: null };
      // A draft or renamed template should not lose the message, so plain text follows.
      console.error("Resend rejected the feedback template", response.status, await response.text());
    }

    const response = await post({ ...base, text });
    if (!response.ok) {
      // Resend's reason can name the owner's account and setup, so it stays in the server log.
      console.error("Resend rejected feedback", response.status, await response.text());
      return { ok: false, status: 502, error: "Your feedback couldn't be sent. Try again in a minute." };
    }
    return { ok: true, value: null };
  } catch (error) {
    console.error("Feedback email failed", error);
    return { ok: false, status: 502, error: "Your feedback couldn't be sent. Try again in a minute." };
  }
}
