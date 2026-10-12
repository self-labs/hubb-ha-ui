export type PendingStatus = 'idle' | 'pending' | 'failed';

interface Entry {
  expected: string;
  startedAt: number;
  failedAt: number | null;
  /** The state seen when the command left, kept only when it already was what was asked for. */
  stale: unknown;
}

/** Remembers what a tap asked for until Home Assistant confirms it, or gives up after `timeoutMs`. */
export class PendingTracker {
  readonly timeoutMs: number;
  readonly failedForMs: number;
  #now: () => number;
  #entries = new Map<string, Entry>();

  constructor(timeoutMs = 3000, failedForMs = 4000, now: () => number = () => Date.now()) {
    this.timeoutMs = timeoutMs;
    this.failedForMs = failedForMs;
    this.#now = now;
  }

  /**
   * `seen` is the state object on screen when the command leaves. When it already shows what was
   * asked (a second tap racing the first), only a newer state object counts as the answer.
   */
  start(entityId: string, expected: string, seen?: { state: string }): void {
    this.#entries.set(entityId, {
      expected,
      startedAt: this.#now(),
      failedAt: null,
      stale: seen && seen.state === expected ? seen : null,
    });
  }

  /** What was asked, while still waiting for it; null otherwise. */
  expected(entityId: string): string | null {
    const e = this.#entries.get(entityId);
    return e && e.failedAt === null ? e.expected : null;
  }

  status(entityId: string, actual: string | undefined, current?: unknown): PendingStatus {
    const e = this.#entries.get(entityId);
    if (!e) return 'idle';
    // A late confirmation also ends a failure: the state is now what was asked.
    if (actual === e.expected && (e.stale === null || current !== e.stale)) {
      this.#entries.delete(entityId);
      return 'idle';
    }
    const now = this.#now();
    if (e.failedAt === null) {
      if (now - e.startedAt < this.timeoutMs) return 'pending';
      // Dated from the end of the wait: a tile seen again a minute later must not replay an old failure.
      e.failedAt = e.startedAt + this.timeoutMs;
    }
    if (now - e.failedAt >= this.failedForMs) {
      this.#entries.delete(entityId);
      return 'idle';
    }
    return 'failed';
  }

  /** Milliseconds until the status changes by time alone; null when nothing is waiting. */
  msUntilChange(entityId: string): number | null {
    const e = this.#entries.get(entityId);
    if (!e) return null;
    const until = e.failedAt === null ? e.startedAt + this.timeoutMs : e.failedAt + this.failedForMs;
    return Math.max(0, until - this.#now());
  }
}
