import type { ActionResult } from "./result";

/** Await a Server Action result; throw an Error carrying the server's message if it failed. */
export async function unwrapAction<T>(pending: Promise<ActionResult<T>>): Promise<T> {
  const result = await pending;
  if (!result.ok) throw new Error(result.error);
  return result.data;
}
