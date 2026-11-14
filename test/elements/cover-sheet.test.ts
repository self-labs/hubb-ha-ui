import { mdiCurtains, mdiCurtainsClosed, mdiStop, mdiTelevision, mdiTelevisionOff } from '@mdi/js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '../../src/elements/cover-panel';
import { pctFromPointerX, type HubbCoverPanel } from '../../src/elements/cover-panel';
import { makeHass, type FakeHass } from '../helpers/fake-hass';

// The sheet of a curtain or a flap: big buttons that answer in colour, a drawing of how open it is, and a
// track for the position when the cover has one (Gustavo, 14/11: "completamente cru e feio").
const OPEN = 1;
const CLOSE = 2;
const POSITION = 4;
const STOP = 8;

function cover(state: string, attributes: Record<string, unknown> = {}, input: { failService?: boolean; platform?: string } = {}): FakeHass {
  return makeHass({
    failService: input.failService,
    entities: [
      {
        entity_id: 'cover.sala',
        state,
        platform: input.platform,
        attributes: { supported_features: OPEN | CLOSE | STOP, ...attributes },
      },
    ],
  });
}

async function panel(hass: FakeHass, kind: 'cover' | 'flap' = 'cover'): Promise<HubbCoverPanel> {
  const el = document.createElement('hubb-cover-panel') as HubbCoverPanel;
  Object.assign(el, { hass, entityId: 'cover.sala', kind });
  document.body.appendChild(el);
  await el.updateComplete;
  return el;
}

const q = (el: Element, sel: string) => el.shadowRoot!.querySelector(sel) as HTMLElement;
const text = (el: Element, sel: string) => el.shadowRoot!.querySelector(sel)?.textContent?.replace(/\s+/g, ' ').trim() ?? null;
const cls = (el: Element, sel: string) => [...q(el, sel).classList];
const path = (el: Element, sel: string) => q(el, `${sel} svg path`).getAttribute('d');
const settle = async (el: HubbCoverPanel) => {
  await vi.advanceTimersByTimeAsync(0);
  await el.updateComplete;
};

describe('the cover sheet buttons', () => {
  afterEach(() => document.body.replaceChildren());

  it('draw the curtain: open and close with their icons, stop with the stop icon', async () => {
    const el = await panel(cover('closed'));
    expect(path(el, '.open')).toBe(mdiCurtains);
    expect(path(el, '.stop')).toBe(mdiStop);
    expect(path(el, '.close')).toBe(mdiCurtainsClosed);
  });

  it('draw a TV for the flap', async () => {
    const el = await panel(cover('closed'), 'flap');
    expect(path(el, '.open')).toBe(mdiTelevision);
    expect(path(el, '.close')).toBe(mdiTelevisionOff);
  });

  it('follow what the cover declares: no Parar without the stop bit, no Abrir or Fechar without theirs', async () => {
    const noStop = await panel(cover('closed', { supported_features: OPEN | CLOSE }));
    expect([...noStop.shadowRoot!.querySelectorAll('.row button')].map((b) => b.textContent!.trim())).toEqual(['Abrir', 'Fechar']);
    document.body.replaceChildren();
    const onlyStop = await panel(cover('open', { supported_features: STOP }));
    expect([...onlyStop.shadowRoot!.querySelectorAll('.row button')].map((b) => b.textContent!.trim())).toEqual(['Parar']);
  });

  it('say nothing and offer nothing when the cover does not answer', async () => {
    const el = await panel(cover('unavailable'));
    expect(text(el, '.now')).toBe('Sem resposta');
    expect(el.shadowRoot!.querySelector('button')).toBeNull();
    expect(el.shadowRoot!.querySelector('.hero')).toBeNull();
  });
});

describe('the answer to a command', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    document.body.replaceChildren();
  });

  it('lights Parar and says "Parar enviado" for four seconds, though the state did not change', async () => {
    const hass = cover('open');
    const el = await panel(hass);
    expect(text(el, '.status')).toBe('');
    q(el, '.stop').click();
    await settle(el);
    expect(hass.calls.map((c) => c.service)).toEqual(['stop_cover']);
    expect(cls(el, '.stop')).toContain('on');
    expect(cls(el, '.open')).not.toContain('on');
    expect(text(el, '.status')).toBe('Parar enviado');
    await vi.advanceTimersByTimeAsync(3900);
    await el.updateComplete;
    expect(cls(el, '.stop')).toContain('on');
    await vi.advanceTimersByTimeAsync(200);
    await el.updateComplete;
    expect(cls(el, '.stop')).not.toContain('on');
    expect(text(el, '.status')).toBe('');
  });

  it('answers Abrir and Fechar the same way, so an infrared cover that flips at once still shows it was heard', async () => {
    const hass = cover('closed');
    const el = await panel(hass);
    q(el, '.open').click();
    await settle(el);
    expect(text(el, '.status')).toBe('Abrir enviado');
    expect(cls(el, '.open')).toContain('on');
    q(el, '.close').click();
    await settle(el);
    expect(text(el, '.status')).toBe('Fechar enviado');
    expect(cls(el, '.close')).toContain('on');
    expect(cls(el, '.open')).not.toContain('on');
  });

  it('says it in the masculine for a flap, and "Abrir enviado" is the same words for both', async () => {
    const el = await panel(cover('closed'), 'flap');
    q(el, '.stop').click();
    await settle(el);
    expect(text(el, '.status')).toBe('Parar enviado');
  });

  it('shakes the button, vibrates and says to try again when the call fails', async () => {
    const seen: string[] = [];
    window.addEventListener('haptic', (e) => seen.push((e as CustomEvent<string>).detail));
    const el = await panel(cover('open', {}, { failService: true }));
    q(el, '.stop').click();
    await settle(el);
    expect(seen).toContain('failure');
    expect(cls(el, '.stop')).toContain('failed');
    expect(cls(el, '.stop')).not.toContain('on');
    expect(text(el, '.status')).toBe('Não deu certo. Tente de novo.');
    await vi.advanceTimersByTimeAsync(4100);
    await el.updateComplete;
    expect(cls(el, '.stop')).not.toContain('failed');
    expect(text(el, '.status')).toBe('');
  });

  it('pulses the button of the direction the cover is moving in', async () => {
    const el = await panel(cover('opening'));
    expect(cls(el, '.open')).toContain('moving');
    expect(cls(el, '.close')).not.toContain('moving');
    document.body.replaceChildren();
    expect(cls(await panel(cover('closing')), '.close')).toContain('moving');
  });

  it('forgets the answer of an old command when a new one goes out', async () => {
    const el = await panel(cover('open'));
    q(el, '.stop').click();
    await settle(el);
    await vi.advanceTimersByTimeAsync(2000);
    q(el, '.close').click();
    await settle(el);
    await vi.advanceTimersByTimeAsync(2500);
    await el.updateComplete;
    // Two and a half seconds after the second command: the first one's four seconds ended, the second's did not.
    expect(cls(el, '.close')).toContain('on');
    expect(cls(el, '.stop')).not.toContain('on');
    expect(text(el, '.status')).toBe('Fechar enviado');
  });

  it('leaves no timer behind when the sheet closes', async () => {
    const el = await panel(cover('open'));
    q(el, '.stop').click();
    await settle(el);
    el.remove();
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('the drawing of how open it is', () => {
  afterEach(() => document.body.replaceChildren());
  const open = (el: Element) => q(el, '.hero').style.getPropertyValue('--open');

  it('follows the position of a curtain', async () => {
    const el = await panel(cover('open', { current_position: 60 }));
    expect(cls(el, '.hero')).toContain('curtain');
    expect(open(el)).toBe('0.6');
  });

  it('is open or closed for a cover with no position', async () => {
    expect(open(await panel(cover('open')))).toBe('1');
    document.body.replaceChildren();
    expect(open(await panel(cover('closed')))).toBe('0');
    document.body.replaceChildren();
    expect(open(await panel(cover('opening')))).toBe('1');
    document.body.replaceChildren();
    expect(open(await panel(cover('unknown')))).toBe('0');
  });

  it('is a flap that comes down for a flap', async () => {
    const el = await panel(cover('open'), 'flap');
    expect(cls(el, '.hero')).toContain('flap');
    expect(cls(el, '.hero')).not.toContain('curtain');
  });

  it('is only a picture: the words say the state to a screen reader', async () => {
    const el = await panel(cover('open', { current_position: 60 }));
    expect(q(el, '.hero').getAttribute('aria-hidden')).toBe('true');
    expect(text(el, '.now')).toBe('60% aberta');
  });
});

describe('the position track', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    document.body.replaceChildren();
  });

  const withPosition = (pos: number, extra: Record<string, unknown> = {}) =>
    cover('open', { supported_features: OPEN | CLOSE | STOP | POSITION, current_position: pos, ...extra });
  /** A track 200 px wide that starts at 0, because happy-dom has no layout. */
  const track = (el: HubbCoverPanel) => {
    const t = q(el, '.track');
    t.getBoundingClientRect = () => ({ left: 0, top: 0, width: 200, height: 44, right: 200, bottom: 44, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;
    return t;
  };
  const pointer = (type: string, clientX: number) => Object.assign(new Event(type, { bubbles: true }), { clientX, pointerId: 1 });

  it('is there only when the cover declares the position bit, never because it reports one', async () => {
    const without = await panel(cover('open', { current_position: 60 }));
    expect(without.shadowRoot!.querySelector('.track')).toBeNull();
    document.body.replaceChildren();
    const el = await panel(withPosition(60));
    expect(q(el, '.track').getAttribute('role')).toBe('slider');
    expect(q(el, '.track').getAttribute('aria-valuenow')).toBe('60');
    expect(q(el, '.track').getAttribute('aria-label')).toBe('Posição');
  });

  it('asks once, when the finger lifts, and the drawing follows the finger meanwhile', async () => {
    const hass = withPosition(60);
    const el = await panel(hass);
    const t = track(el);
    t.dispatchEvent(pointer('pointerdown', 100));
    t.dispatchEvent(pointer('pointermove', 120));
    t.dispatchEvent(pointer('pointermove', 150));
    await el.updateComplete;
    expect(hass.calls).toEqual([]);
    expect(q(el, '.hero').style.getPropertyValue('--open')).toBe('0.75');
    expect(t.getAttribute('aria-valuenow')).toBe('75');
    t.dispatchEvent(pointer('pointerup', 150));
    await settle(el);
    expect(hass.calls.map((c) => [c.service, c.data])).toEqual([['set_cover_position', { position: 75 }]]);
    expect(text(el, '.status')).toBe('Posição 75% enviada');
  });

  it('asks nothing for a move or a lift that did not start on the track', async () => {
    const hass = withPosition(60);
    const el = await panel(hass);
    const t = track(el);
    t.dispatchEvent(pointer('pointermove', 150));
    t.dispatchEvent(pointer('pointerup', 150));
    await settle(el);
    expect(hass.calls).toEqual([]);
  });

  it('keeps what was asked on the track until the cover says it, or three seconds pass', async () => {
    const hass = withPosition(60);
    const el = await panel(hass);
    const t = track(el);
    t.dispatchEvent(pointer('pointerdown', 40));
    t.dispatchEvent(pointer('pointerup', 40));
    await settle(el);
    expect(t.getAttribute('aria-valuenow')).toBe('20');
    await vi.advanceTimersByTimeAsync(3100);
    await el.updateComplete;
    expect(t.getAttribute('aria-valuenow')).toBe('60');
  });

  it('moves with the arrow keys and sends one call when the keys stop', async () => {
    const hass = withPosition(60);
    const el = await panel(hass);
    const t = track(el);
    for (let i = 0; i < 3; i++) t.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    await el.updateComplete;
    expect(t.getAttribute('aria-valuenow')).toBe('75');
    expect(hass.calls).toEqual([]);
    await vi.advanceTimersByTimeAsync(300);
    expect(hass.calls.map((c) => c.data)).toEqual([{ position: 75 }]);
    t.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
    await vi.advanceTimersByTimeAsync(300);
    expect(hass.calls.map((c) => c.data)).toEqual([{ position: 75 }, { position: 0 }]);
  });

  it('still sends the position a key chose when the sheet closes first', async () => {
    const hass = withPosition(60);
    const el = await panel(hass);
    track(el).dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
    el.remove();
    expect(hass.calls.map((c) => c.data)).toEqual([{ position: 100 }]);
  });
});

describe('pctFromPointerX', () => {
  it('reads the finger along the track, clamped to 0 and 100', () => {
    expect(pctFromPointerX(100, 0, 200)).toBe(50);
    expect(pctFromPointerX(-20, 0, 200)).toBe(0);
    expect(pctFromPointerX(260, 0, 200)).toBe(100);
    expect(pctFromPointerX(60, 10, 200)).toBe(25);
    expect(pctFromPointerX(10, 0, 0)).toBe(0);
  });
});

describe('the infrared notice', () => {
  afterEach(() => document.body.replaceChildren());

  it('says the state is the last command sent, as the air and the media sheets do', async () => {
    const el = await panel(cover('open', {}, { platform: 'tasmota_ir' }));
    expect(text(el, '.infrared')).toBe('Controle por infravermelho: mostra o último comando enviado.');
  });

  it('is not shown for a cover that talks to its motor', async () => {
    expect(q(await panel(cover('open')), '.infrared')).toBeNull();
  });
});
