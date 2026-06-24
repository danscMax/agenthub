// Shared monitor list — fetched once and reused across every pane and window, instead of each
// TerminalPane calling list_monitors() on its own (which fired N identical Win32 enumerations).
// Monitors rarely change; call invalidateMonitors() (e.g. after a hotplug) to force a refresh.
import { listMonitors, openMonitorWindow, prepareDetach, type DetachPane, type MonitorInfo } from '$lib/ipc';

let cache: MonitorInfo[] | null = null;
let inflight: Promise<MonitorInfo[]> | null = null;

/** The monitor list, cached. Concurrent callers share one in-flight request. */
export async function getMonitors(): Promise<MonitorInfo[]> {
  if (cache) return cache;
  if (!inflight) {
    inflight = listMonitors()
      .then((m) => {
        cache = m;
        return m;
      })
      .catch(() => [] as MonitorInfo[]) // transient failure → don't cache; next call retries
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

/** Drop the cache so the next getMonitors() re-enumerates (after a monitor hotplug / layout change). */
export function invalidateMonitors(): void {
  cache = null;
}

/**
 * Stash a detached-window spec and open a frameless window on monitor `idx`. The single place the
 * prepareDetach → openMonitorWindow → "did it open?" sequence lives (was duplicated in SessionsTab's
 * distribute/restore and TerminalPane's send-to-monitor). Returns false if the window/monitor was
 * unavailable so the caller can leave the pane(s) where they are.
 */
export async function openDetached(label: string, idx: number, panes: DetachPane[]): Promise<boolean> {
  try {
    await prepareDetach(label, { panes });
    await openMonitorWindow(label, idx);
    return true;
  } catch {
    return false; // monitor/window unavailable
  }
}
