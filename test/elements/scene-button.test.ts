import { afterEach, describe, expect, it } from 'vitest';
import '../../src/elements/scene-button';
import type { HubbSceneButton } from '../../src/elements/scene-button';
import type { SceneItem } from '../../src/model/types';

const CINEMA: SceneItem = { entityId: 'scene.cinema', name: 'Cinema', areaId: 'sala', description: 'Sala e Quarto' };

async function mount(variant: 'tile' | 'row' | 'chip'): Promise<HubbSceneButton> {
  const el = document.createElement('hubb-scene-button') as HubbSceneButton;
  el.scene = CINEMA;
  el.variant = variant;
  document.body.appendChild(el);
  await el.updateComplete;
  return el;
}

describe('hubb-scene-button', () => {
  afterEach(() => { document.body.replaceChildren(); });

  it('asks the screen to run the scene', async () => {
    const el = await mount('tile');
    const runs: SceneItem[] = [];
    document.body.addEventListener('hubb-run-scene', (e) => runs.push((e as CustomEvent<{ scene: SceneItem }>).detail.scene));
    (el.shadowRoot!.querySelector('button') as HTMLButtonElement).click();
    expect(runs).toEqual([CINEMA]);
  });

  it('shows the description only as a row', async () => {
    expect((await mount('row')).shadowRoot!.querySelector('.desc')!.textContent).toBe('Sala e Quarto');
    document.body.replaceChildren();
    expect((await mount('tile')).shadowRoot!.querySelector('.desc')).toBeNull();
  });
});
