import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { configureRest, isResting, resetRestForTests, screenShown, wake } from '../../src/actions/rest';
import { setEditing } from '../../src/editing';
import type { Tablet } from '../../src/model/tablet';
import { resetSelectionForTests, selectedRoom } from '../../src/selection';
import { makeHass, withState, type FakeHass } from '../helpers/fake-hass';

const MIN = 60_000;
const IPAD: Tablet = { room: 'quarto', restAfter: 5, presence: [], notify: 'mobile_app_ipad_da_lia', platform: 'ios' };

function hass(presence = 'off', failService = false): FakeHass {
  return makeHass({ failService, entities: [{ entity_id: 'binary_sensor.presenca', name: 'Presença', state: presence }] });
}

const notifies = (h: FakeHass) => h.calls.filter((c) => c.domain === 'notify').map((c) => [c.service, c.data]);

/** The tablet as a page of the panel left it: configured, with the screen lit once, and the calls forgotten. */
function configured(tablet: Tablet | null, h: FakeHass): void {
  configureRest(tablet, h);
  h.calls.length = 0;
}

/** The commands go one after the other: each waits for the one before. */
const settle = async (): Promise<void> => {
  for (let i = 0; i < 5; i++) await Promise.resolve();
};

let gone: () => void = () => undefined;

describe('a wall tablet rests and wakes up', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(Date.parse('2026-10-21T12:00:00Z'));
    history.replaceState(null, '', '/hubb-casa/cozinha');
    // A screen of the panel on the page: the rest only happens over the panel.
    gone = screenShown();
  });
  afterEach(() => {
    gone();
    resetRestForTests();
    resetSelectionForTests();
    setEditing(false);
    vi.useRealTimers();
  });

  it('rests after five minutes with no touch, on the home of the panel, and dims an iPad', () => {
    const h = hass();
    configured(IPAD, h);
    vi.advanceTimersByTime(5 * MIN - 1000);
    expect(isResting()).toBe(false);
    vi.advanceTimersByTime(2000);
    expect(isResting()).toBe(true);
    expect(location.pathname).toBe('/hubb-casa/home');
    expect(notifies(h)).toEqual([['mobile_app_ipad_da_lia', { message: 'kiosk_set_brightness', data: { level: 5 } }]]);
  });

  it('a touch puts the rest off', () => {
    configureRest(IPAD, hass());
    vi.advanceTimersByTime(4 * MIN);
    window.dispatchEvent(new Event('pointerdown'));
    vi.advanceTimersByTime(2 * MIN);
    expect(isResting()).toBe(false);
    vi.advanceTimersByTime(4 * MIN);
    expect(isResting()).toBe(true);
  });

  it('waking goes back to the room of the tablet and lights an Android screen again', async () => {
    const h = hass();
    configureRest({ ...IPAD, notify: 'mobile_app_moto_da_lia', platform: 'android' }, h);
    vi.advanceTimersByTime(5 * MIN);
    await settle();
    h.calls.length = 0;
    wake();
    await settle();
    expect(isResting()).toBe(false);
    expect(selectedRoom()).toBe('quarto');
    expect(notifies(h)).toEqual([
      ['mobile_app_moto_da_lia', { message: 'command_screen_on', data: { command: 'keep_screen_on' } }],
      ['mobile_app_moto_da_lia', { message: 'command_auto_screen_brightness', data: { command: 'turn_on' } }],
    ]);
  });

  it('a command the app refuses changes nothing for the resident', async () => {
    configureRest(IPAD, hass('off', true));
    vi.advanceTimersByTime(5 * MIN);
    await Promise.resolve();
    expect(isResting()).toBe(true);
  });

  it('never rests in the edit mode, nor with rest_after 0', () => {
    setEditing(true);
    configureRest(IPAD, hass());
    vi.advanceTimersByTime(10 * MIN);
    expect(isResting()).toBe(false);
    setEditing(false);
    resetRestForTests();
    configureRest({ ...IPAD, restAfter: 0 }, hass());
    vi.advanceTimersByTime(60 * MIN);
    expect(isResting()).toBe(false);
  });

  it('presence switching on wakes it; presence held on does not keep it awake', () => {
    const tablet = { ...IPAD, presence: ['binary_sensor.presenca'] };
    const off = hass('off');
    configureRest(tablet, off);
    vi.advanceTimersByTime(5 * MIN);
    expect(isResting()).toBe(true);
    configureRest(tablet, withState(off, 'binary_sensor.presenca', 'on'));
    expect(isResting()).toBe(false);
    // On all the time (a stuck sensor): it still rests.
    vi.advanceTimersByTime(5 * MIN);
    expect(isResting()).toBe(true);
  });

  it('a user with no tablet never rests', () => {
    configureRest(null, hass());
    vi.advanceTimersByTime(60 * MIN);
    expect(isResting()).toBe(false);
  });

  it('never rests while no screen of the panel is on the page (the resident swiped to the map)', () => {
    const h = hass();
    configured(IPAD, h);
    gone();
    vi.advanceTimersByTime(30 * MIN);
    expect(isResting()).toBe(false);
    expect(notifies(h)).toEqual([]);
    // Back on the panel, the minutes count from there.
    gone = screenShown();
    vi.advanceTimersByTime(5 * MIN - 1000);
    expect(isResting()).toBe(false);
    vi.advanceTimersByTime(2000);
    expect(isResting()).toBe(true);
  });

  it('a page of the panel rebuilt by Home Assistant does not put the rest off', () => {
    configured(IPAD, hass());
    vi.advanceTimersByTime(4 * MIN);
    gone();
    gone = screenShown();
    vi.advanceTimersByTime(MIN + 1000);
    expect(isResting()).toBe(true);
  });

  it('resting with no screen of the panel on the page, a touch wakes it', async () => {
    const h = hass();
    configured(IPAD, h);
    vi.advanceTimersByTime(5 * MIN);
    expect(isResting()).toBe(true);
    gone();
    h.calls.length = 0;
    window.dispatchEvent(new Event('pointerdown'));
    await settle();
    expect(isResting()).toBe(false);
    expect(notifies(h)).toEqual([['mobile_app_ipad_da_lia', { message: 'kiosk_set_brightness', data: { level: 80 } }]]);
  });

  it('a page that opens as a tablet lights the screen once: a reload while it rested left it dim', async () => {
    const h = hass();
    configureRest(IPAD, h);
    configureRest(IPAD, hass());
    await settle();
    expect(notifies(h)).toEqual([['mobile_app_ipad_da_lia', { message: 'kiosk_set_brightness', data: { level: 80 } }]]);
  });

  it('the tablet taken off (or moved to another device) while resting lights the old device', async () => {
    const h = hass();
    configured(IPAD, h);
    vi.advanceTimersByTime(5 * MIN);
    await settle();
    h.calls.length = 0;
    configureRest(null, h);
    await settle();
    expect(isResting()).toBe(false);
    expect(notifies(h)).toEqual([['mobile_app_ipad_da_lia', { message: 'kiosk_set_brightness', data: { level: 80 } }]]);
  });

  it('sends the commands of an Android one after the other', async () => {
    const h = hass();
    configured({ ...IPAD, notify: 'mobile_app_moto_da_lia', platform: 'android' }, h);
    await settle();
    let release: () => void = () => undefined;
    const sent: string[] = [];
    h.callService = ((_d: string, _s: string, data: { message: string }) => {
      sent.push(data.message);
      return new Promise<void>((r) => (release = r));
    }) as typeof h.callService;
    vi.advanceTimersByTime(5 * MIN);
    await settle();
    expect(sent).toEqual(['command_auto_screen_brightness']);
    release();
    await settle();
    expect(sent).toEqual(['command_auto_screen_brightness', 'command_screen_brightness_level']);
  });
});
