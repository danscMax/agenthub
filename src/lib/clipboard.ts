// Copy text to the clipboard. Returns true on success so callers can flash feedback.
// Centralises the navigator.clipboard try/catch that was duplicated across cards.
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
