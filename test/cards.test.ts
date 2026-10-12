import { afterEach, describe, expect, it } from 'vitest';
import '../src/cards/error-card';
import '../src/cards/light-card';
import type { HubbErrorCard } from '../src/cards/error-card';
import { HubbLightCard } from '../src/cards/light-card';
import type { HubbDimmerPanel } from '../src/elements/dimmer-panel';
import type { HubbLightTile } from '../src/elements/light-tile';
import type { HubbSheet } from '../src/elements/sheet';
import { makeHass } from './helpers/fake-hass';

describe('hubb-error-card', () => {
  afterEach(() => { document.body.replaceChildren(); });

  it('shows the message to everyone and the detail to admins only', async () => {
    const el = document.createElement('hubb-error-card') as HubbErrorCard;
    el.setConfig({ type: 'custom:hubb-error-card', message: 'Não foi possível montar o painel.', detail: 'boom' });
    el.hass = makeHass();
    document.body.appendChild(el);
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('.message')!.textContent).toBe('Não foi possível montar o painel.');
    expect(el.shadowRoot!.querySelector('.detail')).toBeNull();
    el.hass = makeHass({ user: { id: 'a', name: 'Gustavo', is_admin: true } });
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('.detail')!.textContent).toBe('boom');
  });
});

describe('hubb-light-card', () => {
  afterEach(() => { document.body.replaceChildren(); });

  it('refuses a config with no entity', () => {
    const el = document.createElement('hubb-light-card') as HubbLightCard;
    expect(() => el.setConfig({ type: 'custom:hubb-light-card' } as never)).toThrow('hubb-light-card: missing entity');
  });

  it('renders one tile with the display name, or the name from the config', async () => {
    const el = document.createElement('hubb-light-card') as HubbLightCard;
    el.setConfig({ type: 'custom:hubb-light-card', entity: 'light.mesa' });
    el.hass = makeHass({ entities: [{ entity_id: 'light.mesa', name: 'Mesa', state: 'on', attributes: { supported_color_modes: ['brightness'], brightness: 255 } }] });
    document.body.appendChild(el);
    await el.updateComplete;
    const tile = el.shadowRoot!.querySelector('hubb-light-tile') as HubbLightTile;
    expect(tile.item).toEqual({ entityId: 'light.mesa', name: 'Mesa', dimmable: true });
    el.setConfig({ type: 'custom:hubb-light-card', entity: 'light.mesa', name: 'Mesa de jantar' });
    await el.updateComplete;
    expect((el.shadowRoot!.querySelector('hubb-light-tile') as HubbLightTile).item!.name).toBe('Mesa de jantar');
  });

  it('opens its own light sheet on a long press, as the card picker promises', async () => {
    const el = document.createElement('hubb-light-card') as HubbLightCard;
    el.setConfig({ type: 'custom:hubb-light-card', entity: 'light.mesa' });
    el.hass = makeHass({ entities: [{ entity_id: 'light.mesa', name: 'Mesa', state: 'on', attributes: { supported_color_modes: ['hs'], brightness: 255 } }] });
    document.body.appendChild(el);
    await el.updateComplete;
    el.shadowRoot!.querySelector('hubb-light-tile')!.dispatchEvent(
      new CustomEvent('hubb-open-dimmer', { detail: { entityId: 'light.mesa', name: 'Mesa' }, bubbles: true, composed: true }),
    );
    await el.updateComplete;
    const sheet = el.shadowRoot!.querySelector('hubb-sheet') as HubbSheet;
    expect(sheet.open).toBe(true);
    expect(sheet.heading).toBe('Mesa');
    expect((sheet.querySelector('hubb-dimmer-panel') as HubbDimmerPanel).entityId).toBe('light.mesa');
    expect(sheet.querySelector('hubb-color-panel')).not.toBeNull();
    sheet.close();
    await el.updateComplete;
    expect(sheet.querySelector('hubb-dimmer-panel')).toBeNull();
  });

  it('suggests the first light of the house when added from the card picker', () => {
    const h = makeHass({ entities: [{ entity_id: 'switch.tv', state: 'on' }, { entity_id: 'light.sala', state: 'off' }, { entity_id: 'light.cozinha', state: 'on' }] });
    expect(HubbLightCard.getStubConfig(h)).toEqual({ entity: 'light.cozinha' });
    expect(HubbLightCard.getStubConfig(makeHass())).toEqual({ entity: 'light.exemplo' });
  });
});
