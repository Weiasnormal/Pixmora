/** An error whose message was written for people, so it is safe to show in the interface. */
export class FriendlyError extends Error {}

/**
 * The message to show for any caught error. Library, browser and server errors can be technical
 * or name private setup, so only friendly ones are shown; the rest go to the console for debugging.
 */
export function friendlyMessage(error: unknown, fallback: string): string {
  if (error instanceof FriendlyError) return error.message;
  console.error(error);
  return fallback;
}
