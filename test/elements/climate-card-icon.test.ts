import { afterEach, describe, expect, it } from 'vitest';
import '../../src/elements/climate-card';
import type { HubbClimateCard } from '../../src/elements/climate-card';
import { airConditionerIcon } from '../../src/elements/air-conditioner-icon';
import { modeIcon } from '../../src/model/climate-mode';
import { makeHass, type FakeHass } from '../helpers/fake-hass';

// The idle air conditioner is a drawn split unit, not the fan with the letters "A/C" of the stock icon
// (Gustavo, 14/11). While it runs, the icon is still the one of its mode.
function ar(state: string): FakeHass {
  return makeHass({
    entities: [
      {
        entity_id: 'climate.ar',
        name: 'Ar',
        state,
        attributes: { hvac_modes: ['off', 'cool'], temperature: 23, current_temperature: 27, min_temp: 16, max_temp: 30, supported_features: 1 | 8 | 128 },
      },
    ],
  });
}

async function card(hass: FakeHass): Promise<HubbClimateCard> {
  const el = document.createElement('hubb-climate-card') as HubbClimateCard;
  el.hass = hass;
  el.item = { entityId: 'climate.ar', name: 'Ar', kind: 'climate' };
  document.body.appendChild(el);
  await el.updateComplete;
  return el;
}

const drawn = (el: HubbClimateCard) => el.shadowRoot!.querySelector('.icon path')!.getAttribute('d');

describe('the icon of the air conditioner card', () => {
  afterEach(() => document.body.replaceChildren());

  it('draws the split unit while it is off', async () => {
    expect(drawn(await card(ar('off')))).toBe(airConditionerIcon);
  });

  it('keeps the icon of the mode while it runs', async () => {
    expect(drawn(await card(ar('cool')))).toBe(modeIcon('cool'));
  });
});
