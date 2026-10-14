import { afterEach, describe, expect, it, vi } from 'vitest';
import '../../src/elements/climate-card';
import '../../src/elements/climate-panel';
import '../../src/elements/cover-panel';
import '../../src/elements/cover-tile';
import '../../src/elements/media-card';
import '../../src/elements/media-panel';
import { makeHass, type FakeHass } from '../helpers/fake-hass';

type Mounted = HTMLElement & { updateComplete: Promise<unknown> };

async function mount(tag: string, props: Record<string, unknown>): Promise<Mounted> {
  const el = document.createElement(tag) as Mounted;
  Object.assign(el, props);
  document.body.appendChild(el);
  await el.updateComplete;
  return el;
}

/** What a device keeps in Home Assistant while it is down or unknown: its features and lists. */
function device(entity_id: string, state: string): FakeHass {
  return makeHass({
    entities: [
      {
        entity_id,
        state,
        attributes: {
          supported_features: 0xffff,
          hvac_modes: ['off', 'cool', 'dry'],
          fan_modes: ['auto', 'high'],
          temperature: 23,
          source_list: ['HDMI 1'],
          volume_level: 0.4,
          current_position: 40,
        },
      },
    ],
  });
}

const text = (el: Element, sel: string) => el.shadowRoot!.querySelector(sel)?.textContent?.replace(/\s+/g, ' ').trim() ?? null;
const buttons = (el: Element) => el.shadowRoot!.querySelectorAll('button, select').length;

describe('the M3 devices when they do not answer or do not know', () => {
  afterEach(() => {
    vi.useRealTimers();
    document.body.replaceChildren();
  });

  it('shows only Sem resposta on the sheet of a device that is down', async () => {
    const sheets: [string, string][] = [
      ['hubb-climate-panel', 'climate.ar'],
      ['hubb-climate-panel', 'fan.teto'],
      ['hubb-cover-panel', 'cover.cortina'],
      ['hubb-media-panel', 'media_player.tv'],
    ];
    for (const [tag, entityId] of sheets) {
      const el = await mount(tag, { hass: device(entityId, 'unavailable'), entityId });
      expect([tag, entityId, text(el, '.now'), buttons(el)]).toEqual([tag, entityId, 'Sem resposta', 0]);
    }
  });

  it('does not show "unknown" nor light up a curtain, an air conditioner or a player that does not know its state', async () => {
    const cover = await mount('hubb-cover-tile', { hass: device('cover.cortina', 'unknown'), item: { entityId: 'cover.cortina', name: 'Cortina' } });
    expect(text(cover, '.state')).toBe('');
    expect(cover.shadowRoot!.querySelector('.tile.on')).toBeNull();
    const ar = await mount('hubb-climate-card', { hass: device('climate.ar', 'unknown'), item: { entityId: 'climate.ar', name: 'Ar', kind: 'climate' } });
    expect(text(ar, '.state')).toBe('');
    expect(ar.shadowRoot!.querySelector('.card.on')).toBeNull();
    const tv = await mount('hubb-media-card', { hass: device('media_player.tv', 'unknown'), item: { entityId: 'media_player.tv', name: 'TV' } });
    expect(text(tv, '.state')).toBe('');
    expect(tv.shadowRoot!.querySelector('.card.on')).toBeNull();
  });

  it('still sends the temperature asked when the sheet closes before it went out', async () => {
    vi.useFakeTimers();
    const h = device('climate.ar', 'cool');
    const el = await mount('hubb-climate-panel', { hass: h, entityId: 'climate.ar' });
    (el.shadowRoot!.querySelector('.warmer') as HTMLButtonElement).click();
    el.remove();
    await vi.advanceTimersByTimeAsync(1000);
    expect(h.calls.map((c) => [`${c.domain}.${c.service}`, c.data])).toEqual([['climate.set_temperature', { temperature: 24 }]]);
  });
});
