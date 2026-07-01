// U1: single source of truth for the tab order. The Sidebar renders it, drag/keyboard reorder
// mutates it, and +page derives the Ctrl+1..9 jumps and the palette's number hints from it — so
// the shortcuts always match what the user actually sees (they used to follow a separate
// hardcoded list in a different order).
//
// Persistence contract (unchanged from the Sidebar's original implementation): the saved order is
// honored only when stamped with the current ORD_VER; bumping ORD_VER re-seeds everyone to the new
// default once, while later manual reorders persist again.

const DEFAULT_ORDER = [
  'home',
  'sessions',
  'profiles',
  'providers',
  'mcp',
  'envs',
  'extensions',
  'schedule',
  'analytics',
  'sync',
  'updates',
  'forks',
  'backup',
  'settings'
];
const ORD_KEY = 'cmh-sidebar-order';
const ORD_VER_KEY = 'cmh-sidebar-order-ver';
const ORD_VER = '4';

function initialOrder(): string[] {
  try {
    const saved = JSON.parse(localStorage.getItem(ORD_KEY) ?? '[]');
    if (localStorage.getItem(ORD_VER_KEY) === ORD_VER && Array.isArray(saved) && saved.length) {
      const valid = saved.filter((id: string) => DEFAULT_ORDER.includes(id));
      const missing = DEFAULT_ORDER.filter((id) => !valid.includes(id));
      return [...valid, ...missing];
    }
    localStorage.setItem(ORD_KEY, JSON.stringify(DEFAULT_ORDER));
    localStorage.setItem(ORD_VER_KEY, ORD_VER);
  } catch {
    /* first run / storage unavailable */
  }
  return [...DEFAULT_ORDER];
}

/** Reactive ordered tab ids (SPA, ssr=false — safe to read localStorage at module init). */
export const navOrder = $state({ ids: initialOrder() });

/** Set a new order without persisting (live drag preview). */
export function previewNavOrder(ids: string[]) {
  navOrder.ids = ids;
}

/** Set and persist a new order (drop / keyboard move). */
export function setNavOrder(ids: string[]) {
  navOrder.ids = ids;
  try {
    localStorage.setItem(ORD_KEY, JSON.stringify(ids));
    localStorage.setItem(ORD_VER_KEY, ORD_VER);
  } catch {
    /* ignore */
  }
}
