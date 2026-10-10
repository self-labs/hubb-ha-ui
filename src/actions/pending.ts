export type PendingStatus = 'idle' | 'pending' | 'failed';

interface Entry {
  expected: string;
  startedAt: number;
  failedAt: number | null;
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

  start(entityId: string, expected: string): void {
    this.#entries.set(entityId, { expected, startedAt: this.#now(), failedAt: null });
  }

  /** What was asked, while still waiting for it; null otherwise. */
  expected(entityId: string): string | null {
    const e = this.#entries.get(entityId);
    return e && e.failedAt === null ? e.expected : null;
  }

  status(entityId: string, actual: string | undefined): PendingStatus {
    const e = this.#entries.get(entityId);
    if (!e) return 'idle';
    const now = this.#now();
    if (e.failedAt === null) {
      if (actual === e.expected) {
        this.#entries.delete(entityId);
        return 'idle';
      }
      if (now - e.startedAt >= this.timeoutMs) {
        e.failedAt = now;
        return 'failed';
      }
      return 'pending';
    }
    if (now - e.failedAt >= this.failedForMs) {
      this.#entries.delete(entityId);
      return 'idle';
    }
    return 'failed';
  }
}
