import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MEDIA_FEATURE } from '../../src/actions/media';
import '../../src/elements/mini-player';
import type { HubbToast } from '../../src/elements/toast';
import { reportArea, resetLayoutForTests } from '../../src/layout';
import { buildHouse } from '../../src/model/build-house';
import { nowPlaying } from '../../src/model/media';
import '../../src/screens/home-screen';
import type { HubbScreen } from '../../src/screens/base';
import { resetSelectionForTests } from '../../src/selection';
import { flush } from '../helpers/fake-dashboard';
import { area, makeHass, type FakeHass } from '../helpers/fake-hass';

const F = MEDIA_FEATURE.play | MEDIA_FEATURE.pause | MEDIA_FEATURE.next;

function house(salaState = 'playing', quartoState = 'playing'): FakeHass {
  return makeHass({
    areas: [area('quarto', 'Quarto'), area('sala', 'Sala')],
    entities: [
      { entity_id: 'media_player.caixa_quarto', area_id: 'quarto', platform: 'wiim', name: 'Caixa', state: quartoState, attributes: { supported_features: F, media_title: 'Noturno', media_artist: 'Lia' } },
      { entity_id: 'media_player.caixa_sala', area_id: 'sala', platform: 'wiim', name: 'Caixa', state: salaState, attributes: { supported_features: F, media_title: 'Fim de Tarde', media_artist: 'Banda Imaginária' } },
    ],
  });
}

describe('the music playing, at the foot of the column of the wide home', () => {
  beforeEach(() => history.replaceState(null, '', '/hubb-casa/home'));
  afterEach(() => {
    resetLayoutForTests();
    resetSelectionForTests();
    for (const el of document.querySelectorAll('hubb-home-screen')) (el.shadowRoot?.querySelector('hubb-toast') as HubbToast | null)?.hide();
    document.body.replaceChildren();
  });

  it('prefers the speaker playing in the room open on the right; none when nothing plays', () => {
    const h = house();
    const b = buildHouse(h);
    expect(nowPlaying(b, h, 'sala')?.entityId).toBe('media_player.caixa_sala');
    expect(nowPlaying(b, h, null)?.entityId).toBe('media_player.caixa_quarto');
    const quiet = house('paused', 'idle');
    expect(nowPlaying(buildHouse(quiet), quiet, null)).toBeNull();
  });

  it('shows the song and a tap on it opens the sheet of the speaker, which a rebuild keeps open', async () => {
    reportArea({ left: 0, top: 0, width: 1280, height: 800 }, 800);
    const h = house('playing', 'idle');
    const el = document.createElement('hubb-home-screen') as HubbScreen & { setConfig(c: unknown): void };
    el.setConfig({ type: 'custom:hubb-home-screen', house: buildHouse(h) });
    el.hass = h;
    document.body.appendChild(el);
    await flush();
    await el.updateComplete;
    const mini = el.shadowRoot!.querySelector('aside.side hubb-mini-player') as HTMLElement & { updateComplete: Promise<unknown> };
    await mini.updateComplete;
    expect(mini.shadowRoot!.querySelector('.title')!.textContent).toBe('Fim de Tarde');
    (mini.shadowRoot!.querySelector('.body') as HTMLButtonElement).click();
    await el.updateComplete;
    const sheet = el.shadowRoot!.querySelector('hubb-sheet.media')!;
    expect(sheet.hasAttribute('open')).toBe(true);
    expect((sheet.querySelector('hubb-media-panel') as HTMLElement & { entityId: string }).entityId).toBe('media_player.caixa_sala');
  });

  it('play and pause from the column', async () => {
    const h = house('playing', 'idle');
    const el = document.createElement('hubb-mini-player') as HTMLElement & { hass: unknown; item: unknown; updateComplete: Promise<unknown> };
    el.hass = h;
    el.item = { entityId: 'media_player.caixa_sala', name: 'Caixa' };
    document.body.appendChild(el);
    await el.updateComplete;
    (el.shadowRoot!.querySelector('.play') as HTMLButtonElement).click();
    expect(h.calls.map((c) => [c.service, c.target?.entity_id])).toEqual([['media_play_pause', 'media_player.caixa_sala']]);
  });
});
