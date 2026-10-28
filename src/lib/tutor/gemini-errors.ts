// Classifies a Gemini SDK error so the routes can say what went wrong instead of a bare 502. Pure,
// no imports, so node:test can run it. The detail is trimmed and never contains the API key.

export type GeminiErrorCode = "no_key" | "auth" | "model" | "quota" | "bad_request" | "unavailable" | "unknown";

export type GeminiErrorInfo = {
  code: GeminiErrorCode;
  /** HTTP status from Gemini, when there was one. */
  status?: number;
  /** A short, safe description for logs and for the demo's error line. */
  detail: string;
};

const KEY_LIKE = /AIza[0-9A-Za-z_-]{20,}/g;

function statusOf(err: unknown): number | undefined {
  if (typeof err === "object" && err !== null && "status" in err) {
    const status = (err as { status: unknown }).status;
    if (typeof status === "number") return status;
  }
  return undefined;
}

export function describeGeminiError(err: unknown): GeminiErrorInfo {
  const raw = err instanceof Error ? err.message : String(err);
  const message = raw.replace(KEY_LIKE, "[key]").replace(/\s+/g, " ").trim();
  const detail = message.slice(0, 300);
  const status = statusOf(err) ?? Number(/got status: (\d{3})/.exec(message)?.[1] ?? NaN);
  const known = Number.isFinite(status) ? status : undefined;

  if (/api key|API_KEY|apiKey|authenticat/i.test(message) && /(missing|not valid|invalid|expired|must be set|provide)/i.test(message)) {
    return { code: known === undefined ? "no_key" : "auth", status: known, detail };
  }
  if (known === 401 || known === 403 || /PERMISSION_DENIED|UNAUTHENTICATED/.test(message)) {
    return { code: "auth", status: known, detail };
  }
  if (known === 404 || /NOT_FOUND|is not found|not supported for/i.test(message)) {
    return { code: "model", status: known, detail };
  }
  if (known === 429 || /RESOURCE_EXHAUSTED|quota/i.test(message)) return { code: "quota", status: known, detail };
  if (known === 400 || /INVALID_ARGUMENT/.test(message)) return { code: "bad_request", status: known, detail };
  if (known !== undefined && known >= 500) return { code: "unavailable", status: known, detail };
  return { code: "unknown", status: known, detail };
}

/** True when another model may succeed where this one failed (the key and quota are fine). */
export function worthTryingAnotherModel(info: GeminiErrorInfo): boolean {
  return info.code === "model" || info.code === "bad_request" || info.code === "unavailable";
}
