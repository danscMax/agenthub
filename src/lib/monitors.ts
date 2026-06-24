// Shared monitor list — fetched once and reused across every pane and window, instead of each
// TerminalPane calling list_monitors() on its own (which fired N identical Win32 enumerations).
// Monitors rarely change; call invalidateMonitors() (e.g. after a hotplug) to force a refresh.
import { listMonitors, type MonitorInfo } from '$lib/ipc';

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
