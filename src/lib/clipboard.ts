import { writeText as tauriWriteText } from '@tauri-apps/plugin-clipboard-manager';

// Copy text to the clipboard. Returns true on success so callers can flash feedback.
// In the Tauri WebView2 shell the WEB clipboard is silently non-functional — both
// `navigator.clipboard.writeText` AND `execCommand('copy')` no-op with no error — so the native
// clipboard plugin (OS clipboard via Rust) is the reliable path. The web paths remain as a fallback
// for non-Tauri contexts (browser dev / screenshot harness), where the plugin's IPC call rejects.
export async function copyText(text: string): Promise<boolean> {
  try {
    await tauriWriteText(text);
    return true;
  } catch {
    /* not running under Tauri (browser/dev) or plugin error — try the web clipboard paths */
  }
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* clipboard API present but blocked — fall through to the legacy path */
  }
  return legacyCopy(text);
}

// execCommand('copy') is deprecated but still works in Chromium/WebView2 and needs no permission;
// it requires a focused, selected element and a user gesture (the click that triggered the copy).
function legacyCopy(text: string): boolean {
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    // Keep it out of view and prevent the page from scrolling/zooming to it.
    ta.style.position = 'fixed';
    ta.style.top = '-9999px';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, text.length); // iOS/WebView quirk: select() alone isn't always enough
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}
