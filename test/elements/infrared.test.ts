import { afterEach, describe, expect, it } from 'vitest';
import '../../src/elements/climate-panel';
import '../../src/elements/media-panel';
import { makeHass } from '../helpers/fake-hass';

async function mount(tag: string, entityId: string, platform: string): Promise<HTMLElement> {
  const h = makeHass({
    entities: [
      { entity_id: entityId, state: 'off', platform, attributes: { hvac_modes: ['off', 'cool'], supported_features: 1 | 128 | 256 } },
    ],
  });
  const el = document.createElement(tag) as HTMLElement & { hass: unknown; entityId: string; updateComplete: Promise<unknown> };
  el.hass = h;
  el.entityId = entityId;
  document.body.appendChild(el);
  await el.updateComplete;
  return el;
}

const note = (el: HTMLElement) => el.shadowRoot!.querySelector('.infrared')?.textContent?.trim() ?? null;

describe('a device controlled by infrared', () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it('says on its sheet that the state is the last command sent', async () => {
    expect(note(await mount('hubb-climate-panel', 'climate.ar_ir', 'tasmota_ir'))).toBe('Controle por infravermelho: mostra o último comando enviado.');
    expect(note(await mount('hubb-media-panel', 'media_player.tv_ir', 'smartir'))).toBe('Controle por infravermelho: mostra o último comando enviado.');
  });

  it('says nothing for a device that reports its own state', async () => {
    expect(note(await mount('hubb-climate-panel', 'climate.ar', 'lg_thinq'))).toBeNull();
    expect(note(await mount('hubb-media-panel', 'media_player.tv', 'webostv'))).toBeNull();
  });
});
