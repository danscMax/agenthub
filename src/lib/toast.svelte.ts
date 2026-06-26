// Tiny app-wide toast store (Svelte 5 runes). Surfaces operation outcomes so users get a
// glanceable result without reading the execution log. Errors are sticky (manual dismiss).
export type ToastKind = 'success' | 'warn' | 'error' | 'info';
export type ToastAction = { label: string; onClick: () => void };
export type Toast = {
  id: number;
  kind: ToastKind;
  title: string;
  detail?: string;
  action?: ToastAction;
};

let seq = 0;
export const toastStore = $state<{ items: Toast[] }>({ items: [] });

// Live auto-dismiss timers, keyed by toast id, so the stack can pause while the user hovers/reads it
// (errors are sticky and never armed). The remembered ttl lets resume restart a fresh countdown.
const timers = new Map<number, { ttl: number; handle: ReturnType<typeof setTimeout> }>();

function arm(id: number, ttl: number): void {
  timers.set(id, { ttl, handle: setTimeout(() => dismiss(id), ttl) });
}

export function pushToast(t: Omit<Toast, 'id'>, ttlMs = 6000): number {
  const id = ++seq;
  toastStore.items.push({ ...t, id });
  if (t.kind !== 'error' && ttlMs > 0) arm(id, ttlMs);
  return id;
}

// Pause/resume every pending auto-dismiss — wired to the toast host's hover so an actionable toast
// (Open log / jump-to-tab) doesn't vanish mid-read or while the user reaches for its button.
export function pauseToasts(): void {
  for (const tm of timers.values()) clearTimeout(tm.handle);
}
export function resumeToasts(): void {
  for (const [id, tm] of [...timers]) arm(id, tm.ttl);
}

export function dismiss(id: number): void {
  const tm = timers.get(id);
  if (tm) clearTimeout(tm.handle);
  timers.delete(id);
  toastStore.items = toastStore.items.filter((x) => x.id !== id);
}

// Clear the whole stack at once (a bulk failure can spawn many sticky error toasts).
export function dismissAll(): void {
  for (const tm of timers.values()) clearTimeout(tm.handle);
  timers.clear();
  toastStore.items = [];
}
