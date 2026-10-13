import { describe, expect, it, vi } from 'vitest';
import { copyText } from '../../src/actions/clipboard';

function stub(secure: boolean, writeText?: (text: string) => Promise<void>): void {
  Object.defineProperty(window, 'isSecureContext', { value: secure, configurable: true });
  Object.defineProperty(navigator, 'clipboard', { value: writeText ? { writeText } : undefined, configurable: true });
}

describe('copyText', () => {
  it('uses the Clipboard API in a secure context', async () => {
    const writeText = vi.fn(() => Promise.resolve());
    stub(true, writeText);
    expect(await copyText('a: b')).toBe(true);
    expect(writeText).toHaveBeenCalledWith('a: b');
  });

  it('falls back to a hidden textarea on plain http, and leaves nothing behind', async () => {
    stub(false);
    const exec = vi.fn(() => true);
    Object.defineProperty(document, 'execCommand', { value: exec, configurable: true });
    expect(await copyText('a: b')).toBe(true);
    expect(exec).toHaveBeenCalledWith('copy');
    expect(document.querySelector('textarea')).toBeNull();
  });

  it('says so when neither way works', async () => {
    stub(true, () => Promise.reject(new Error('denied')));
    Object.defineProperty(document, 'execCommand', { value: () => false, configurable: true });
    expect(await copyText('a: b')).toBe(false);
  });
});
