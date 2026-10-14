/**
 * Copies text: the Clipboard API where the page is a secure context, else a hidden textarea and
 * execCommand (Home Assistant on plain http:// inside the house has no Clipboard API). False when
 * neither works, so the screen can leave the text there to copy by hand.
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (window.isSecureContext && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Denied, or the page lost the focus: try the old way.
  }
  try {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.style.fontSize = '16px';
    area.select();
    area.setSelectionRange(0, text.length);
    const ok = typeof document.execCommand === 'function' && document.execCommand('copy');
    area.remove();
    return ok;
  } catch {
    return false;
  }
}
