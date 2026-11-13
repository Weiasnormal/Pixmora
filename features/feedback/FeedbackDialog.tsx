"use client";

import { useId, useState } from "react";
import { CheckCircle2, Loader2, Star } from "lucide-react";
import { Button, Checkbox, Modal, Notice, TextField } from "@/components/ui";
import { markFeedbackSent } from "./prompt";
import { MESSAGE_LIMIT } from "./send";

type Status = { kind: "idle" } | { kind: "sending" } | { kind: "sent" } | { kind: "error"; message: string };

function Stars({ value, onChange }: { value: number | null; onChange: (value: number | null) => void }) {
  return (
    <div role="radiogroup" aria-label="Rating" className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = value !== null && star <= value;
        return (
          <button
            key={star}
            type="button"
            role="radio"
            aria-checked={value === star}
            aria-label={`${star} ${star === 1 ? "star" : "stars"}`}
            // Choosing the same star again clears the rating, since it is optional.
            onClick={() => onChange(value === star ? null : star)}
            className="inline-flex size-9 items-center justify-center rounded-lg transition-[background-color,transform] duration-150 ease-out hover:bg-page active:scale-95 max-md:size-11"
          >
            <Star
              aria-hidden
              className={`size-6 ${filled ? "fill-primary text-primary" : "text-line-strong"}`}
            />
          </button>
        );
      })}
    </div>
  );
}

/** Rating and message form. It sends only what the person types, never their photos. */
export function FeedbackDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const messageId = useId();
  const [rating, setRating] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [shareDetails, setShareDetails] = useState(true);
  const [website, setWebsite] = useState("");
  const [missingMessage, setMissingMessage] = useState(false);
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const close = () => {
    if (status.kind === "sent") {
      setRating(null);
      setMessage("");
      setEmail("");
      setStatus({ kind: "idle" });
    }
    onClose();
  };

  const send = async () => {
    if (!message.trim()) {
      setMissingMessage(true);
      return;
    }
    setStatus({ kind: "sending" });
    const context = shareDetails
      ? `${location.pathname} · ${innerWidth} × ${innerHeight} · ${navigator.userAgent}`
      : "";
    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, message, email, context, website }),
      });
      const result = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        // Only the route's own messages are shown; anything else, such as a hosting error page,
        // gets the plain fallback.
        const known = [400, 413, 429, 502, 503].includes(response.status) && result.error;
        setStatus({
          kind: "error",
          message: known ? result.error! : "Your feedback couldn't be sent. Try again in a minute.",
        });
        return;
      }
      markFeedbackSent();
      setStatus({ kind: "sent" });
    } catch {
      setStatus({ kind: "error", message: "You seem to be offline. Check your connection and try again." });
    }
  };

  const sending = status.kind === "sending";

  return (
    <Modal
      open={open}
      title="Send feedback"
      onClose={close}
      footer={
        status.kind === "sent" ? (
          <Button variant="primary" onClick={close}>
            Close
          </Button>
        ) : (
          <>
            <Button onClick={close}>Cancel</Button>
            <Button variant="primary" disabled={sending} onClick={() => void send()}>
              {sending ? <Loader2 aria-hidden className="size-4 animate-spin" /> : null}
              {sending ? "Sending…" : "Send feedback"}
            </Button>
          </>
        )
      }
    >
      {status.kind === "sent" ? (
        <div className="flex flex-col items-center gap-2 py-4 text-center" role="status">
          <CheckCircle2 aria-hidden className="size-8 text-primary" />
          <p className="text-[15px] font-semibold">Thanks, your feedback was sent</p>
          <p className="text-sm text-muted">Every message is read and helps shape what Pixmora does next.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <span className="text-[13px] text-muted">How is Pixmora working for you? (optional)</span>
            <Stars value={rating} onChange={setRating} />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor={messageId} className="text-[13px] text-muted">
              What should we fix, add or keep?
            </label>
            <textarea
              id={messageId}
              rows={5}
              maxLength={MESSAGE_LIMIT}
              value={message}
              aria-invalid={missingMessage}
              aria-describedby={`${messageId}-hint`}
              placeholder="The package setup was confusing because…"
              onChange={(event) => {
                setMessage(event.target.value);
                setMissingMessage(false);
              }}
              className="w-full min-w-0 resize-y rounded-lg border border-line bg-panel px-2.5 py-2 text-sm text-ink transition-colors duration-150 placeholder:text-muted hover:border-line-strong aria-invalid:border-danger max-md:text-base"
            />
            <span id={`${messageId}-hint`} className="flex justify-between text-xs">
              <span className="text-danger">{missingMessage ? "Write a message first." : ""}</span>
              <span className="text-muted tabular-nums">
                {message.length} / {MESSAGE_LIMIT}
              </span>
            </span>
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] text-muted">Your email, only if you’d like a reply</span>
            <TextField value={email} onChange={setEmail} placeholder="name@example.com" />
          </label>

          <Checkbox
            label="Include the page, screen size and browser"
            description="Helps track down layout problems."
            checked={shareDetails}
            onChange={setShareDetails}
          />

          {/* Hidden from people; spam bots fill it in and are ignored. */}
          <input
            type="text"
            name="website"
            tabIndex={-1}
            autoComplete="off"
            aria-hidden
            value={website}
            onChange={(event) => setWebsite(event.target.value)}
            className="absolute -left-[9999px] size-px opacity-0"
          />

          {status.kind === "error" ? <Notice tone="error">{status.message}</Notice> : null}

          <p className="text-xs leading-relaxed text-muted">
            This emails your rating and message to the Pixmora team. Your photos are never sent.
          </p>
        </div>
      )}
    </Modal>
  );
}

/** A plain text button with its own dialog, for pages outside the Studio. */
export function FeedbackLink({ className = "" }: { className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`font-medium underline underline-offset-2 transition-colors duration-150 hover:text-ink ${className}`}
      >
        Send feedback
      </button>
      <FeedbackDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
}
