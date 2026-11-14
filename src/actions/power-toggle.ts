import type { HassEntityState } from '../ha/types';
import { haptic } from './haptic';
import { PendingTracker } from './pending';

/**
 * What the Ligar or Apagar button of a sheet shows: the state, or what the last press asked for until
 * Home Assistant answers (the same 3 s wait as the tiles). The sheet draws the button; this keeps the wait.
 */
export class PowerToggle {
  readonly #tracker = new PendingTracker();
  readonly #host: { requestUpdate(): void };
  #timers: ReturnType<typeof setTimeout>[] = [];

  constructor(host: { requestUpdate(): void }) {
    this.#host = host;
  }

  /**
   * `on` is what to show (what was asked while waiting); `pending` while the answer has not come; `failed`
   * for a few seconds after the wait ended with no answer, so the sheet can say "Sem resposta" like the tiles.
   */
  view(entityId: string, st: HassEntityState | undefined): { on: boolean; pending: boolean; failed: boolean } {
    const status = this.#tracker.status(entityId, st?.state, st);
    if (status === 'pending') return { on: this.#tracker.expected(entityId) === 'on', pending: true, failed: false };
    return { on: st?.state === 'on', pending: false, failed: status === 'failed' };
  }

  /** Asks for the opposite of what is shown, and redraws now and when the wait ends. */
  press(entityId: string, st: HassEntityState | undefined, send: (on: boolean) => Promise<unknown>): void {
    const { on } = this.view(entityId, st);
    this.#tracker.start(entityId, on ? 'off' : 'on', st);
    haptic('light');
    this.dispose();
    // One redraw when the wait ends (the failure shows) and one when the failure ends.
    for (const after of [this.#tracker.timeoutMs + 50, this.#tracker.timeoutMs + this.#tracker.failedForMs + 100]) {
      this.#timers.push(setTimeout(() => this.#host.requestUpdate(), after));
    }
    this.#host.requestUpdate();
    send(!on).catch(() => haptic('failure'));
  }

  /** The sheet went away: no redraw for a wait that is over. */
  dispose(): void {
    for (const t of this.#timers) clearTimeout(t);
    this.#timers = [];
  }
}
