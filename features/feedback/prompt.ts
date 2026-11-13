const EXPORTS_KEY = "pixmora-export-count";
const SENT_KEY = "pixmora-feedback-sent-at";
/** Ask after the first export, then every fifth, and leave people alone after they reply. */
const ASK_EVERY = 5;
const QUIET_AFTER_SENDING_MS = 30 * 24 * 60 * 60 * 1000;

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage blocked: the prompt simply comes up more often.
  }
}

export function markFeedbackSent() {
  write(SENT_KEY, String(Date.now()));
}

/** Counts a finished export and says whether to ask for a rating this time. */
export function shouldAskAfterExport(now = Date.now()): boolean {
  const count = Number(read(EXPORTS_KEY) ?? 0) + 1;
  write(EXPORTS_KEY, String(count));
  const sentAt = Number(read(SENT_KEY) ?? 0);
  if (sentAt && now - sentAt < QUIET_AFTER_SENDING_MS) return false;
  return count === 1 || count % ASK_EVERY === 0;
}
