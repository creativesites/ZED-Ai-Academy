// Downloads the scripted demo's voice lines ahead of time and hands back local blob: URLs, so a
// line plays the instant the teacher says it, with no network at play time. Lines download in play
// order, two at a time. When the voice service is not available (no Gemini key, an outage), the
// first failure stops the downloads and every line gets null: the browser voice reads them instead.

const PARALLEL = 2;

export class VoiceLoader {
  private readonly ready = new Map<string, Promise<string | null>>();
  private readonly objectUrls: string[] = [];
  private failed = false;
  /** Why the voice service failed, for the console. */
  failure: string | null = null;

  constructor(private readonly urls: readonly string[]) {
    const resolvers = new Map<string, (value: string | null) => void>();
    for (const url of urls) {
      this.ready.set(url, new Promise((resolve) => resolvers.set(url, resolve)));
    }

    if (typeof fetch === "undefined" || typeof URL.createObjectURL !== "function") {
      for (const resolve of resolvers.values()) resolve(null);
      return;
    }

    let next = 0;
    const worker = async () => {
      while (next < urls.length) {
        const url = urls[next++];
        const resolve = resolvers.get(url)!;
        if (this.failed) {
          resolve(null);
          continue;
        }
        resolve(await this.download(url));
      }
    };
    for (let i = 0; i < PARALLEL; i++) void worker();
  }

  /** The local URL for a line, or null when it is not available within `timeoutMs`. */
  async get(url: string, timeoutMs: number): Promise<string | null> {
    const pending = this.ready.get(url);
    if (!pending) return null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<null>((resolve) => {
      timer = setTimeout(() => resolve(null), timeoutMs);
    });
    try {
      return await Promise.race([pending, timeout]);
    } finally {
      clearTimeout(timer);
    }
  }

  /** Frees the downloaded audio. */
  dispose(): void {
    for (const url of this.objectUrls) URL.revokeObjectURL(url);
    this.objectUrls.length = 0;
  }

  private async download(url: string): Promise<string | null> {
    try {
      const res = await fetch(url);
      const type = res.headers.get("content-type") ?? "";
      if (!res.ok || !type.startsWith("audio/")) {
        this.failed = true;
        const body = await res.json().catch(() => null);
        this.failure = `${res.status} ${(body && (body.reason || body.error)) || type}`;
        console.warn("[ZAI Tutor] demo voice unavailable, using the browser voice:", this.failure, body?.detail ?? "");
        return null;
      }
      const objectUrl = URL.createObjectURL(await res.blob());
      this.objectUrls.push(objectUrl);
      return objectUrl;
    } catch (err) {
      this.failed = true;
      this.failure = err instanceof Error ? err.message : String(err);
      console.warn("[ZAI Tutor] demo voice unavailable, using the browser voice:", this.failure);
      return null;
    }
  }
}
