// C3: thin wrapper over @tauri-apps/plugin-updater + plugin-process. Keeps the Tauri imports in one
// place so the Settings UI stays declarative and the flow is easy to reason about / mock.
import { check, type Update, type DownloadEvent } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';

export type UpdateInfo = {
  update: Update; // keep the handle — downloadAndInstall lives on it
  version: string;
  currentVersion: string;
  notes: string;
};

/** Query the configured endpoint for a newer signed release. Returns null when up to date. */
export async function checkForUpdate(): Promise<UpdateInfo | null> {
  const update = await check();
  if (!update) return null;
  return {
    update,
    version: update.version,
    currentVersion: update.currentVersion,
    notes: update.body ?? ''
  };
}

/**
 * Download + install the update, reporting 0..100 progress (or -1 when the server sends no length).
 * On success the app relaunches into the new version (NSIS finishes the swap on restart).
 */
export async function installUpdate(info: UpdateInfo, onProgress: (pct: number) => void): Promise<void> {
  let total = 0;
  let got = 0;
  await info.update.downloadAndInstall((ev: DownloadEvent) => {
    if (ev.event === 'Started') {
      total = ev.data.contentLength ?? 0;
      onProgress(total ? 0 : -1);
    } else if (ev.event === 'Progress') {
      got += ev.data.chunkLength;
      onProgress(total ? Math.round((got / total) * 100) : -1);
    } else if (ev.event === 'Finished') {
      onProgress(100);
    }
  });
  await relaunch();
}
