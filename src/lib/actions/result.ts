// Server Actions that throw lose their message in production builds ("An error occurred in the
// Server Components render…"), so authors never learn why a save failed. Actions return a result
// instead; `unwrapAction` (client) turns a failed result back into an Error with the real message.

import { unstable_rethrow } from "next/navigation";

export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

export async function toActionResult<T>(label: string, fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (err) {
    unstable_rethrow(err); // keep redirect() / notFound() working
    const message = err instanceof Error && err.message ? err.message : "Something went wrong. Please try again.";
    console.error(`[action:${label}]`, err);
    return { ok: false, error: message };
  }
}
