export type Theme = 'dark' | 'light' | 'system';
const KEY = 'cmh-theme';
const mq = () =>
  typeof matchMedia !== 'undefined' ? matchMedia('(prefers-color-scheme: dark)') : null;

export function getTheme(): Theme {
  if (typeof localStorage === 'undefined') return 'dark';
  const t = localStorage.getItem(KEY) as Theme | null;
  return t === 'light' || t === 'system' || t === 'dark' ? t : 'dark';
}

// Effective light/dark for a setting ('system' follows the OS preference).
export function resolveTheme(t: Theme): 'dark' | 'light' {
  if (t === 'system') return mq()?.matches ? 'dark' : 'light';
  return t;
}

export function applyTheme(t: Theme): void {
  document.documentElement.classList.toggle('light', resolveTheme(t) === 'light');
  if (typeof localStorage !== 'undefined') localStorage.setItem(KEY, t);
}

let mqBound = false;
export function initTheme(): void {
  applyTheme(getTheme());
  // Re-apply when the OS theme flips, but only while the user is on "system".
  const m = mq();
  if (m && !mqBound) {
    mqBound = true;
    m.addEventListener('change', () => {
      if (getTheme() === 'system') applyTheme('system');
    });
  }
}
