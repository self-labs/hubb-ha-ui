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

  it('says it is on, to the eye and to screen readers, while its light is on', async () => {
    const el = await mount('chip');
    el.on = true;
    await el.updateComplete;
    expect(el.hasAttribute('on')).toBe(true);
    expect(el.shadowRoot!.querySelector('button .said')?.textContent?.trim()).toBe('Ligada');
    el.on = false;
    await el.updateComplete;
    expect(el.hasAttribute('on')).toBe(false);
    expect(el.shadowRoot!.querySelector('.said')).toBeNull();
  });

  it('hides the word from the eye, never from screen readers', () => {
    const css = ([] as unknown[]).concat((customElements.get('hubb-scene-button') as unknown as { styles: unknown }).styles)
      .map((x) => (x as { cssText: string }).cssText)
      .join('\n');
    const said = css.match(/\.said\s*\{[^}]*\}/)![0];
    expect(said).toContain('clip: rect(0 0 0 0)');
    expect(said).not.toContain('display: none');
  });

  it('keeps the hidden word inside its button, so a lit chip past the edge never widens the page', () => {
    const css = ([] as unknown[]).concat((customElements.get('hubb-scene-button') as unknown as { styles: unknown }).styles)
      .map((x) => (x as { cssText: string }).cssText)
      .join('\n');
    expect(css.match(/\n\s*button\s*\{[^}]*\}/)![0]).toContain('position: relative');
  });
});
