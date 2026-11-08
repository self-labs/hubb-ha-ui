import { afterEach, describe, expect, it, vi } from 'vitest';
import { HubbSceneStrip } from '../../src/elements/scene-strip';

// One line swiped sideways. With no bar, the fade at an edge is all that says more scenes wait there
// (spec Cenas no cômodo, opção C). happy-dom has no layout: the sizes are set by hand.

async function strip(sizes: { scrollWidth: number; clientWidth: number; scrollLeft?: number }): Promise<HubbSceneStrip> {
  const el = document.createElement('hubb-scene-strip') as HubbSceneStrip;
  el.append(document.createElement('button'), document.createElement('button'));
  document.body.appendChild(el);
  await el.updateComplete;
  measure(el, sizes);
  return el;
}

function measure(el: HubbSceneStrip, { scrollWidth, clientWidth, scrollLeft = 0 }: { scrollWidth: number; clientWidth: number; scrollLeft?: number }): void {
  const run = el.shadowRoot!.querySelector('.run') as HTMLElement;
  Object.defineProperty(run, 'scrollWidth', { configurable: true, value: scrollWidth });
  Object.defineProperty(run, 'clientWidth', { configurable: true, value: clientWidth });
  Object.defineProperty(run, 'scrollLeft', { configurable: true, value: scrollLeft });
  run.dispatchEvent(new Event('scroll'));
}

const fades = async (el: HubbSceneStrip): Promise<[boolean, boolean]> => {
  await el.updateComplete;
  return [el.hasAttribute('fade-start'), el.hasAttribute('fade-end')];
};
const cssOf = (styles: unknown): string =>
  ([] as unknown[]).concat(styles).map((s) => (s as { cssText: string }).cssText).join('\n');

describe('hubb-scene-strip', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.replaceChildren();
  });

  it('fades nothing while all its scenes fit', async () => {
    expect(await fades(await strip({ scrollWidth: 300, clientWidth: 300 }))).toEqual([false, false]);
  });

  it('fades the far edge while scenes wait past it', async () => {
    expect(await fades(await strip({ scrollWidth: 700, clientWidth: 300 }))).toEqual([false, true]);
  });

  it('fades both edges in the middle of the line', async () => {
    expect(await fades(await strip({ scrollWidth: 700, clientWidth: 300, scrollLeft: 200 }))).toEqual([true, true]);
  });

  it('fades only the near edge at the end of the line', async () => {
    expect(await fades(await strip({ scrollWidth: 700, clientWidth: 300, scrollLeft: 400 }))).toEqual([true, false]);
  });

  it('ignores the fraction of a pixel a zoomed screen leaves at the end', async () => {
    expect(await fades(await strip({ scrollWidth: 700, clientWidth: 300, scrollLeft: 399.5 }))).toEqual([true, false]);
  });

  it('measures again when its size or a scene changes size', async () => {
    let told: (() => void) | undefined;
    const watched: Element[] = [];
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(callback: () => void) {
          told = callback;
        }
        observe(target: Element): void {
          watched.push(target);
        }
        disconnect(): void {}
      },
    );
    const el = await strip({ scrollWidth: 300, clientWidth: 300 });
    expect(watched.some((t) => t.classList.contains('run'))).toBe(true);
    const run = el.shadowRoot!.querySelector('.run') as HTMLElement;
    Object.defineProperty(run, 'scrollWidth', { configurable: true, value: 700 });
    told!();
    expect(await fades(el)).toEqual([false, true]);
  });

  it('is one line that scrolls sideways, with no bar, and its scenes never shrink', () => {
    const css = cssOf(HubbSceneStrip.styles);
    const run = css.match(/\.run\s*\{[^}]*\}/)![0];
    expect(run).toContain('flex-wrap: nowrap');
    expect(run).toContain('overflow-x: auto');
    expect(run).toContain('scrollbar-width: none');
    expect(run).toContain('overscroll-behavior-x: contain');
    expect(css).toMatch(/::slotted\(\*\)\s*\{[^}]*flex: none/);
  });

  it('draws each fade with a mask, also for an older iPad', () => {
    const css = cssOf(HubbSceneStrip.styles);
    for (const rule of [':host([fade-end]) .run', ':host([fade-start]) .run', ':host([fade-start][fade-end]) .run']) {
      const at = css.indexOf(`${rule} {`);
      expect(at, rule).toBeGreaterThan(-1);
      const block = css.slice(at, css.indexOf('}', at));
      expect(block).toContain('-webkit-mask-image: linear-gradient');
      expect(block).toMatch(/[^-]mask-image: linear-gradient/);
    }
  });
});
