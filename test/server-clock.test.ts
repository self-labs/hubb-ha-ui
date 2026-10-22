import { afterEach, describe, expect, it, vi } from 'vitest';
import '../src/elements/media-progress';
import { resetServerClockForTests, sampleServerClock, serverSkew } from '../src/server-clock';

// The iPad Mini 5 showed a song that had just started at 1:14, and the real time once paused
// (Gustavo, 21/10). Home Assistant was right (position 0, at the time of the server): the clock of
// the iPad was 74 s ahead of the server, and the bar counted from the clock of the iPad.

const T = Date.parse('2026-10-21T21:58:07.000Z');
const st = (lastUpdated: number) => ({ entity_id: 'media_player.caixa', state: 'playing', attributes: {}, last_updated: new Date(lastUpdated).toISOString() });

describe('the clock of the server, seen from this device', () => {
  afterEach(() => {
    resetServerClockForTests();
    vi.useRealTimers();
  });

  it('is learned from a state that just arrived: how far ahead this device runs', () => {
    vi.useFakeTimers();
    vi.setSystemTime(T + 74_000);
    sampleServerClock({ 'media_player.caixa': st(T - 1000) }, { 'media_player.caixa': st(T) });
    expect(serverSkew()).toBe(74_000);
  });

  it('keeps the smallest gap: a state delayed on the way says less about the clock', () => {
    vi.useFakeTimers();
    vi.setSystemTime(T + 74_300);
    sampleServerClock({ a: st(T - 1000) }, { a: st(T) });
    vi.setSystemTime(T + 75_050);
    sampleServerClock({ a: st(T) }, { a: st(T + 1000) });
    expect(serverSkew()).toBe(74_050);
  });

  it('knows nothing before a state changes: no correction', () => {
    expect(serverSkew()).toBe(0);
  });

  it('the bar of a song that just started says 0:00 on a device 74 s ahead', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(T + 74_000);
    sampleServerClock({ a: st(T - 1000) }, { a: st(T) });
    const el = document.createElement('hubb-media-progress') as HTMLElement & Record<string, unknown> & { updateComplete: Promise<unknown> };
    el.duration = 202;
    el.position = 0;
    el.positionAt = T;
    el.playing = true;
    document.body.appendChild(el);
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('.time')!.textContent).toBe('0:00');
    el.remove();
  });
});
