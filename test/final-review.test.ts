import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setEditing } from '../src/editing';
import type { HubbToast } from '../src/elements/toast';
import '../src/elements/toast';
import { reportArea, resetLayoutForTests } from '../src/layout';
import { buildHouse } from '../src/model/build-house';
import { summaryPills } from '../src/model/pills';
import '../src/screens/home-screen';
import '../src/screens/scenes-screen';
import '../src/screens/room-screen';
import type { HubbScreen } from '../src/screens/base';
import { resetSelectionForTests } from '../src/selection';
import { admin, flush, withDashboard } from './helpers/fake-dashboard';
import { area, floor, makeHass } from './helpers/fake-hass';

// What the final review of the tablet work found (21/10), one block per finding.

type Screen = HubbScreen & { setConfig(c: unknown): void };

const cssOf = (tag: string): string =>
  ([] as unknown[])
    .concat((customElements.get(tag) as unknown as { styles: unknown }).styles)
    .map((s) => (s as { cssText: string }).cssText)
    .join('\n');

afterEach(() => {
  setEditing(false);
  resetLayoutForTests();
  resetSelectionForTests();
  for (const el of document.querySelectorAll('hubb-home-screen, hubb-scenes-screen')) {
    (el.shadowRoot?.querySelector('hubb-toast') as HubbToast | null)?.hide();
  }
  document.body.replaceChildren();
});

describe('the undo on a phone', () => {
  it('keeps its dark pill: the background, the padding and the font are not only the wide ones', () => {
    const base = cssOf('hubb-toast').match(/(?:^|\n)\s*\.toast\s*\{[^}]*\}/)![0];
    expect(base).toContain('background: var(--hubb-primary-bg)');
    expect(base).toContain('padding: 10px 10px 10px 16px');
    expect(base).toContain('border-radius: 14px');
    expect(base).toContain('color: var(--hubb-primary-ink)');
  });
});

describe('the wide home on a house with two floors', () => {
  beforeEach(() => {
    history.replaceState(null, '', '/hubb-casa/home');
    reportArea({ left: 0, top: 0, width: 1280, height: 800 }, 800);
  });

  it('opens on the room of the tablet upstairs, with the upstairs tab on', async () => {
    const h = makeHass({
      floors: [floor('terreo', 'Térreo', 0), floor('superior', 'Superior', 1)],
      areas: [area('sala', 'Sala', null, 'terreo'), area('suite', 'Suíte', null, 'superior')],
      entities: [
        { entity_id: 'light.sala', area_id: 'sala', name: 'Teto', state: 'on' },
        { entity_id: 'light.suite', area_id: 'suite', name: 'Cama', state: 'off' },
      ],
    });
    const el = document.createElement('hubb-home-screen') as Screen;
    const tablet = { room: 'suite', restAfter: 0, presence: [], notify: null, platform: null };
    el.setConfig({ type: 'custom:hubb-home-screen', house: buildHouse(h), shared: { alerts: [], security: false, scenes: true, tablet } });
    el.hass = h;
    document.body.appendChild(el);
    await flush();
    await el.updateComplete;
    const pane = el.shadowRoot!.querySelector('section.pane hubb-room-screen[embedded]') as HTMLElement & { config: { room: { areaId: string } } };
    expect(pane.config.room.areaId).toBe('suite');
    const tabs = el.shadowRoot!.querySelector('hubb-floor-tabs') as HTMLElement & { current: string };
    expect(tabs.current).toBe('superior');
  });
});

describe('the security pill', () => {
  function house(states: Record<string, string>) {
    const h = makeHass({
      areas: [area('sala', 'Sala'), area('garagem', 'Garagem')],
      entities: [
        { entity_id: 'light.sala', area_id: 'sala', name: 'Teto', state: 'off' },
        { entity_id: 'binary_sensor.janela', area_id: 'sala', name: 'Janela', state: states.janela ?? 'off', attributes: { device_class: 'window' } },
        // The garage has only its door: a room of sensors, off the home, but on Segurança.
        { entity_id: 'binary_sensor.portao', area_id: 'garagem', name: 'Portão', state: states.portao ?? 'off', attributes: { device_class: 'garage_door' } },
      ],
    });
    return { h, house: buildHouse(h) };
  }

  it('counts what is open in a room of sensors only, as Segurança does', () => {
    const { h, house: b } = house({ portao: 'on' });
    expect(summaryPills(b, h, { security: true, housePower: null }).find((p) => p.kind === 'security')!.title).toBe('1 aberto');
  });

  it('never says "Tudo fechado" while a sensor does not answer', () => {
    const { h, house: b } = house({ janela: 'unavailable' });
    const pill = summaryPills(b, h, { security: true, housePower: null }).find((p) => p.kind === 'security')!;
    expect(pill.title).toBe('1 sem resposta');
    expect(pill.detail).toBe('Janela · Sala');
  });
});

describe('a scene size picked on a tablet', () => {
  it('is saved even when it is the size of the phone', async () => {
    reportArea({ left: 0, top: 0, width: 768, height: 1024 }, 1024);
    history.replaceState(null, '', '/hubb-casa/cenas');
    const h = admin(makeHass({ areas: [], entities: [{ entity_id: 'scene.jantar', area_id: null, name: 'Jantar', state: 'scening' }] }));
    const saves = withDashboard(h, { strategy: { type: 'custom:hubb' } });
    setEditing(true);
    const el = document.createElement('hubb-scenes-screen') as Screen;
    el.setConfig({
      type: 'custom:hubb-scenes-screen',
      scenes: [{ entityId: 'scene.jantar', name: 'Jantar', areaId: null, description: null }],
      lightIds: [],
      options: {},
    });
    el.hass = h;
    document.body.appendChild(el);
    await flush();
    await el.updateComplete;
    const medium = [...el.shadowRoot!.querySelectorAll('.sizes button')].find((b) => b.textContent!.trim() === 'Médio') as HTMLButtonElement;
    medium.click();
    await flush();
    await flush();
    expect((saves.at(-1)!.entities as Record<string, { size?: string }>)['scene.jantar']!.size).toBe('medium');
  });
});

describe('the wide home is the height of the screen, strips included', () => {
  it('the screen is a column as tall as the area, the strips first and the two columns filling the rest', () => {
    const css = cssOf('hubb-home-screen');
    const host = [...css.matchAll(/:host\(\[screen-layout='wide'\]:not\(\[embedded\]\)\)\s*\{[^}]*\}/g)].map((m) => m[0]).join(' ');
    expect(host).toContain('display: flex');
    expect(host).toContain('flex-direction: column');
    expect(host).toContain('height: calc(100vh - var(--hubb-area-top, 0px))');
    expect(host).toContain('height: calc(100dvh - var(--hubb-area-top, 0px))');
    expect(css).toMatch(/\.wide-home\s*\{[^}]*flex: 1 1 auto[^}]*min-height: 0/);
    // The columns no longer take the whole screen each: a strip above them would push them out.
    expect(css).not.toMatch(/\.side[^{]*\{[^}]*height: calc\(100dvh/);
  });

  it('a page scrolled under the screen never makes its top negative', async () => {
    const { areaNow } = await import('../src/layout');
    const el = document.createElement('hubb-home-screen') as Screen;
    el.getBoundingClientRect = () => ({ left: 0, top: -244, width: 1024, height: 768, right: 1024, bottom: 524, x: 0, y: -244, toJSON: () => ({}) });
    Object.defineProperty(window, 'scrollY', { value: 300, configurable: true });
    try {
      el.setConfig({ type: 'custom:hubb-home-screen', house: buildHouse(makeHass({ areas: [], entities: [] })) });
      el.hass = makeHass({ areas: [], entities: [] });
      document.body.appendChild(el);
      await el.updateComplete;
      expect(areaNow().top).toBe(56);
    } finally {
      Object.defineProperty(window, 'scrollY', { value: 0, configurable: true });
    }
  });
});

describe('turning the tablet with a sheet of the room open', () => {
  beforeEach(() => {
    history.replaceState(null, '', '/hubb-casa/home');
    reportArea({ left: 0, top: 0, width: 1280, height: 800 }, 800);
  });

  it('goes to the page of the room, where the sheet opens again', async () => {
    const h = makeHass({
      areas: [area('sala', 'Sala')],
      entities: [{ entity_id: 'media_player.tv', area_id: 'sala', name: 'TV', state: 'playing', attributes: { supported_features: 1 } }],
    });
    const el = document.createElement('hubb-home-screen') as Screen;
    el.setConfig({ type: 'custom:hubb-home-screen', house: buildHouse(h) });
    el.hass = h;
    document.body.appendChild(el);
    await flush();
    await el.updateComplete;
    const room = el.shadowRoot!.querySelector('section.pane hubb-room-screen[embedded]') as Screen;
    await room.updateComplete;
    room.dispatchEvent(new CustomEvent('hubb-open-media', { detail: { entityId: 'media_player.tv' }, bubbles: true, composed: true }));
    await room.updateComplete;
    reportArea({ left: 0, top: 0, width: 768, height: 1024 }, 1024);
    await el.updateComplete;
    expect(location.pathname).toBe('/hubb-casa/sala');
  });

  it('with no sheet open, stays on the home', async () => {
    // Another room: the sheet of the sala above is still kept for two seconds.
    const h = makeHass({ areas: [area('quarto', 'Quarto')], entities: [{ entity_id: 'light.cama', area_id: 'quarto', name: 'Cama', state: 'on' }] });
    const el = document.createElement('hubb-home-screen') as Screen;
    el.setConfig({ type: 'custom:hubb-home-screen', house: buildHouse(h) });
    el.hass = h;
    document.body.appendChild(el);
    await flush();
    await el.updateComplete;
    reportArea({ left: 0, top: 0, width: 768, height: 1024 }, 1024);
    await el.updateComplete;
    expect(location.pathname).toBe('/hubb-casa/home');
  });
});

describe('the keyboard of an Android tablet lying down', () => {
  it('shrinks the height only: the layout stays wide, and the editor open on the right stays', async () => {
    const { layoutNow } = await import('../src/layout');
    reportArea({ left: 0, top: 0, width: 1280, height: 800 }, 800);
    reportArea({ left: 0, top: 0, width: 1280, height: 420 }, 420);
    expect(layoutNow()).toBe('wide');
    // Turning it is another width: the layout follows.
    reportArea({ left: 0, top: 0, width: 800, height: 1280 }, 1280);
    expect(layoutNow()).toBe('roomy');
  });
});

describe('out of reach, on the wide home', () => {
  it('"Apagar tudo" and the scenes in the header of the room take no tap either', async () => {
    reportArea({ left: 0, top: 0, width: 1280, height: 800 }, 800);
    const h = makeHass({ areas: [area('sala', 'Sala')], entities: [{ entity_id: 'light.teto', area_id: 'sala', name: 'Teto', state: 'on' }] });
    h.connected = false;
    const b = buildHouse(h);
    const el = document.createElement('hubb-room-screen') as Screen;
    el.setConfig({ type: 'custom:hubb-room-screen', room: b.rooms[0]!, lightIds: ['light.teto'] });
    el.hass = h;
    document.body.appendChild(el);
    await el.updateComplete;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('.hero .actions')!.hasAttribute('inert')).toBe(true);
  });
});

describe('the selects of the wall tablet and of Ajustes', () => {
  it('a tablet whose room was deleted shows an empty line, so picking a room sends it', async () => {
    await import('../src/elements/tablet-editor');
    const h = makeHass({ areas: [area('sala', 'Sala')], entities: [{ entity_id: 'light.teto', area_id: 'sala', name: 'Teto', state: 'off' }] });
    h.services = { notify: { mobile_app_ipad: {} } };
    const el = document.createElement('hubb-tablet-editor') as HTMLElement & Record<string, unknown> & { updateComplete: Promise<unknown> };
    el.hass = h;
    el.rooms = buildHouse(h).rooms;
    el.userId = 'u_lia';
    el.name = 'Lia';
    el.value = { room: 'garagem', presence: 'binary_sensor.apagado', notify: 'mobile_app_velho' };
    document.body.appendChild(el);
    await el.updateComplete;
    for (const cls of ['room', 'presence', 'device']) {
      const first = el.shadowRoot!.querySelector(`select.${cls} option`) as HTMLOptionElement;
      expect(first.disabled, cls).toBe(true);
      expect(first.hasAttribute('selected'), cls).toBe(true);
    }
  });

  it('two quick changes of the tablet both stay: each sends only its own key', async () => {
    const h = admin(makeHass({ areas: [area('sala', 'Sala')], entities: [] }));
    const saves = withDashboard(h, { strategy: { type: 'custom:hubb', tablets: { u_lia: { room: 'sala' } } } });
    const { setTablets } = await import('../src/actions/dashboard-config');
    await Promise.all([setTablets(h, 'hubb-casa', { u_lia: { rest_after: 2 } }), setTablets(h, 'hubb-casa', { u_lia: { notify: 'mobile_app_ipad' } })]);
    expect((saves.at(-1)!.tablets as Record<string, unknown>).u_lia).toEqual({ room: 'sala', rest_after: 2, notify: 'mobile_app_ipad' });
    await setTablets(h, 'hubb-casa', { u_lia: { notify: undefined } });
    expect((saves.at(-1)!.tablets as Record<string, unknown>).u_lia).toEqual({ room: 'sala', rest_after: 2 });
  });
});

describe('the device of the tablet', () => {
  it('is the one of the Home Assistant app, when a Browser Mod device has the same name', async () => {
    const { platformOf } = await import('../src/model/tablet');
    const h = makeHass({ areas: [], entities: [] });
    h.devices = {
      d_browser: { id: 'd_browser', area_id: null, name: 'iPad da Lia', name_by_user: null, manufacturer: 'Browser Mod' },
      d_app: { id: 'd_app', area_id: null, name: 'iPad da Lia', name_by_user: null, manufacturer: 'Apple' },
    } as unknown as typeof h.devices;
    h.entities['sensor.ipad_bateria'] = { entity_id: 'sensor.ipad_bateria', device_id: 'd_app', platform: 'mobile_app', area_id: null, labels: [] } as unknown as (typeof h.entities)[string];
    expect(platformOf(h, 'mobile_app_ipad_da_lia')).toBe('ios');
  });
});

describe('Revisar the tablets', () => {
  it('says when the room of a tablet is hidden for its own user', async () => {
    const { readTablets } = await import('../src/model/tablet');
    const h = makeHass({ areas: [area('suite', 'Suíte')], entities: [] });
    const { problems } = readTablets(h, { tablets: { u_tablet: { room: 'suite' } }, rooms: { suite: { hidden_for: ['u_tablet'] } } });
    expect(problems.map((p) => p.key)).toEqual(['tablets.u_tablet.room']);
  });
});

describe('the forecast after Home Assistant restarts', () => {
  it('a subscription refused (the weather not ready yet) is asked again', async () => {
    const { subscribeForecast } = await import('../src/actions/forecast');
    vi.useFakeTimers();
    try {
      const h = makeHass();
      let push: ((msg: { forecast: unknown[] }) => void) | null = null;
      let tries = 0;
      h.connection = {
        subscribeMessage: async (cb: (msg: { forecast: unknown[] }) => void) => {
          tries += 1;
          if (tries === 1) throw new Error('not ready');
          push = cb;
          return () => undefined;
        },
      } as unknown as NonNullable<typeof h.connection>;
      const got: unknown[] = [];
      const off = subscribeForecast(h, 'weather.reinicio', 'hourly', (items) => got.push(items));
      await vi.advanceTimersByTimeAsync(30_000);
      expect(tries).toBe(2);
      push!({ forecast: [{ datetime: 'x', temperature: 20 }] });
      expect(got).toHaveLength(1);
      off();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('the edit mode of the wide home', () => {
  it('a tap on a room picks it for the right side: no room page, no extra step back', async () => {
    reportArea({ left: 0, top: 0, width: 1280, height: 800 }, 800);
    history.replaceState(null, '', '/hubb-casa/home');
    const h = admin(
      makeHass({
        areas: [area('quarto', 'Quarto'), area('sala', 'Sala')],
        entities: [
          { entity_id: 'light.cama', area_id: 'quarto', name: 'Cama', state: 'off' },
          { entity_id: 'light.teto', area_id: 'sala', name: 'Teto', state: 'on' },
        ],
      }),
    );
    withDashboard(h, { strategy: { type: 'custom:hubb' } });
    setEditing(true);
    const el = document.createElement('hubb-home-screen') as Screen;
    el.setConfig({ type: 'custom:hubb-home-screen', house: buildHouse(h), options: {} });
    el.hass = h;
    document.body.appendChild(el);
    await flush();
    await el.updateComplete;
    const steps = history.length;
    const card = el.shadowRoot!.querySelector('.room-edit[data-name="Quarto"] hubb-room-card') as HTMLElement & { updateComplete: Promise<unknown> };
    await card.updateComplete;
    (card.shadowRoot!.querySelector('button') as HTMLButtonElement).click();
    await el.updateComplete;
    expect(location.pathname).toBe('/hubb-casa/home');
    expect(history.length).toBe(steps);
    const pane = el.shadowRoot!.querySelector('section.pane hubb-room-screen[embedded]') as HTMLElement & { config: { room: { areaId: string } } };
    expect(pane.config.room.areaId).toBe('quarto');
  });
});

describe('small words of the tablet', () => {
  it('a tablet with no room says only when it rests', async () => {
    const { SETTINGS } = await import('../src/strings');
    expect(SETTINGS.summary('', '5 min')).toBe('Descansa em 5 min');
    expect(SETTINGS.summary('Sala', '5 min')).toBe('Sala · descansa em 5 min');
  });

  it('the rest screen shows the weather the home shows', async () => {
    await import('../src/elements/rest-screen');
    const h = makeHass({ areas: [], entities: [] });
    h.states['weather.zz_casa'] = { entity_id: 'weather.zz_casa', state: 'sunny', attributes: { temperature: 20 } };
    h.states['weather.aa_outro'] = { entity_id: 'weather.aa_outro', state: 'rainy', attributes: { temperature: 10 } };
    h.entities['weather.zz_casa'] = { entity_id: 'weather.zz_casa', area_id: null, labels: [] } as unknown as (typeof h.entities)[string];
    h.entities['weather.aa_outro'] = { entity_id: 'weather.aa_outro', area_id: null, labels: [] } as unknown as (typeof h.entities)[string];
    const el = document.createElement('hubb-rest-screen') as HTMLElement & Record<string, unknown> & { updateComplete: Promise<unknown> };
    el.hass = h;
    el.weatherId = 'weather.zz_casa';
    document.body.appendChild(el);
    await el.updateComplete;
    expect((el.shadowRoot!.querySelector('hubb-weather-now') as HTMLElement & { entityId: string }).entityId).toBe('weather.zz_casa');
  });
});
