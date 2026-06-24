<script lang="ts">
  import { onMount } from 'svelte';
  import TerminalPane from './TerminalPane.svelte';
  import FolderField from './FolderField.svelte';
  import Toggle from './Toggle.svelte';
  import { t } from '$lib/i18n';
  import {
    sessionWrite,
    type SessionTool,
    type DetachPane,
    type SshHost,
    readSshHosts,
    testSshHost,
    saveSshHost,
    deleteSshHost,
    sshTarget,
    parseSshTarget,
    pickFolder
  } from '$lib/ipc';
  import { getMonitors, invalidateMonitors, openDetached } from '$lib/monitors';
  import Select from './Select.svelte';
  import { markMoved, peekMoved } from '$lib/sessionMove';
  import { listen, type UnlistenFn } from '@tauri-apps/api/event';
  import { ARG_PRESETS, toggleFlag } from '$lib/sessionPresets';
  import { pushToast } from '$lib/toast.svelte';

  const MAX_PANES = 12; // each pane is a pwsh+tool process — cap to keep the machine responsive

  let {
    profiles = [],
    visible = true,
    folderReq = null,
    onFolderReqConsumed
  }: {
    profiles?: string[];
    visible?: boolean;
    // Deep-link from another tab: when set, open the launch dialog prefilled with this folder.
    folderReq?: string | null;
    onFolderReqConsumed?: () => void;
  } = $props();

  type Pane = {
    key: string;
    profile: string;
    tool: SessionTool;
    cwd: string;
    args: string;
    remoteDir?: string; // ssh: remote start dir (cd into it on connect)
    sshTarget?: string; // when set, the env runs over SSH on this target (location ≠ this PC)
    name?: string;
    attachId?: string; // when set, this pane ATTACHES to a live session (e.g. returned from a monitor)
    ownsSession?: boolean; // an attached pane that owns the session (kills it on close)
  };
  function renamePane(key: string, name: string) {
    panes = panes.map((p) => (p.key === key ? { ...p, name: name || undefined } : p));
  }
  // The key (not the profile) identifies a pane, so the same profile can run in several at once.
  let panes = $state<Pane[]>([]);
  let seq = 0;
  let columns = $state(2);
  let maximized = $state<string | null>(null); // key of the pane shown full-screen, or null

  // Persisted prefs: column count + last folder used per profile (so re-launching a profile lands
  // in the same place).
  const FKEY = 'cmh-sessions-folders';
  const CKEY = 'cmh-sessions-cols';
  const WKEY = 'cmh-sessions-workspaces';
  const DAKEY = 'cmh-sessions-defargs';
  const RRKEY = 'cmh-remote-recent'; // recently-used SSH remote start dirs (datalist for #19)
  const MLKEY = 'cmh-monitor-layout'; // saved "разнести" arrangement, offered for restore on launch
  let savedLayoutExists = $state(false); // is there a saved monitor layout to restore / forget (#13)
  let lastFolders = $state<Record<string, string>>({});
  // Default launch args, seeded into the phrase's args field for Claude/opencode.
  let defaultArgs = $state('');
  // Collapsible launcher settings (default args, projects root) — collapsed by default.
  let launcherOpen = $state(false);
  // A workspace is a named set of session configs you can re-launch with one click.
  type WsConfig = { tool: SessionTool; profile: string; cwd: string; args: string; remoteDir?: string; sshTarget?: string };
  let workspaces = $state<Record<string, WsConfig[]>>({});
  // Lifecycle: this tab unmounts/remounts on every tab switch, so event listeners MUST be torn down
  // (else they pile up and a returned pane gets added N times). `mounted` also gates async state
  // writes (checkReach) that may resolve after unmount.
  let mounted = true;
  let disposed = false;
  const offs: UnlistenFn[] = [];
  const track = (p: Promise<UnlistenFn>) => {
    p.then((un) => (disposed ? un() : offs.push(un))).catch(() => {});
  };
  onMount(() => {
    try {
      lastFolders = JSON.parse(localStorage.getItem(FKEY) ?? '{}');
      workspaces = JSON.parse(localStorage.getItem(WKEY) ?? '{}');
      defaultArgs = localStorage.getItem(DAKEY) ?? '';
      favorites = JSON.parse(localStorage.getItem(VKEY) ?? '[]');
      projectsRoot = localStorage.getItem(ROOT) ?? '';
      remoteRecent = JSON.parse(localStorage.getItem(RRKEY) ?? '[]');
      const c = Number(localStorage.getItem(CKEY));
      if (c >= 1 && c <= 3) columns = c;
      const fz = Number(localStorage.getItem('cmh-sessions-fontsize'));
      if (fz >= 8 && fz <= 28) globalFont = fz;
      launcherOpen = localStorage.getItem('cmh-sessions-launcher') === '1';
    } catch {
      /* first run / private mode */
    }
    // SSH quick-connect dropdown: load saved + imported ~/.ssh/config hosts (1-click reconnect).
    readSshHosts()
      .then((h) => {
        sshHostList = h;
        checkReach(h);
      })
      .catch(() => {});
    // A pane returned from a detached monitor window (← Castellyn): re-attach it here as the owner.
    track(
      listen<{ target: string; pane: DetachPane }>('pane:add', (e) => {
        const p = e.payload;
        if (p?.target !== 'main' || !p.pane?.sessionId) return;
        addPane({
          tool: p.pane.tool,
          profile: p.pane.profile ?? '',
          cwd: p.pane.cwd ?? '',
          args: p.pane.args ?? '',
          attachId: p.pane.sessionId,
          ownsSession: true
        });
      })
    );
    // A detached monitor window failed to build (open_monitor_window worker thread). The live session
    // is still running but its window never appeared — recover the single-pane case by re-attaching it
    // here, and always tell the user instead of silently "losing" the pane.
    track(
      listen<{ label: string; error: string }>('monitor-window-failed', (e) => {
        const label = e.payload?.label ?? '';
        if (label.startsWith('pane-')) {
          const sessionId = label.slice('pane-'.length);
          addPane({ tool: 'shell', profile: '', cwd: '', args: '', attachId: sessionId, ownsSession: true });
        }
        pushToast({ kind: 'error', title: t('sessions.monitorOpenFailed') });
      })
    );
    // Offer to restore the last monitor arrangement (the user's "restore on launch" choice). A toast
    // with a one-click action — non-aggressive: we don't auto-spawn a grid of terminals every start.
    try {
      const saved = localStorage.getItem(MLKEY);
      savedLayoutExists = !!(saved && saved !== '{}');
      if (savedLayoutExists) {
        pushToast({
          kind: 'info',
          title: t('sessions.restoreLayoutPrompt'),
          action: { label: t('sessions.restoreLayoutAction'), onClick: restoreLayout }
        });
      }
    } catch {
      /* ignore */
    }
    return () => {
      mounted = false;
      disposed = true;
      offs.forEach((un) => un());
    };
  });
  $effect(() => {
    try {
      localStorage.setItem(CKEY, String(columns));
    } catch {
      /* ignore */
    }
  });
  function rememberFolder(profile: string, folder: string) {
    if (!profile) return;
    lastFolders = { ...lastFolders, [profile]: folder };
    try {
      localStorage.setItem(FKEY, JSON.stringify(lastFolders));
    } catch {
      /* ignore */
    }
  }

  // Unread-output markers for panes that printed while hidden (off-screen behind a maximized pane).
  let unread = $state<Record<string, boolean>>({});
  function onActivity(key: string) {
    if (maximized && maximized !== key) unread = { ...unread, [key]: true };
  }

  // Broadcast: mirror keystrokes from any pane to every running session.
  let broadcast = $state(false);
  const sessionIds: Record<string, string> = {};
  function onIdChange(key: string, id: string | null) {
    if (id) sessionIds[key] = id;
    else delete sessionIds[key];
  }
  function broadcastInput(data: string) {
    for (const id of Object.values(sessionIds)) sessionWrite(id, data);
  }
  // One-shot: send a typed command (+Enter) to EVERY running session, without enabling
  // continuous broadcast.
  let sendAllText = $state('');
  function sendToAll() {
    const cmd = sendAllText.trim();
    if (!cmd) return;
    for (const id of Object.values(sessionIds)) sessionWrite(id, cmd + '\r');
    sendAllText = '';
  }

  // "Разнести по мониторам": open a detached window per (non-primary) monitor and spread the running
  // panes across them as a grid. Each pane mirrors its LIVE session via attach (no respawn); the main
  // window keeps its panes too. If there's only one monitor, this is a no-op (with a hint).
  async function distributeToMonitors() {
    invalidateMonitors(); // a monitor may have been (un)plugged since the cached enumeration
    let mons;
    try {
      mons = await getMonitors();
    } catch {
      return;
    }
    const targets = mons.filter((m) => !m.primary);
    const use = targets.length ? targets : mons;
    if (use.length < 1 || mons.length < 2) {
      pushToast({ kind: 'info', title: t('sessions.distributeNone') });
      return;
    }
    // Assign each running pane to a target monitor (round-robin), grouped per monitor.
    type Entry = { key: string; dp: DetachPane };
    const byMon = new Map<number, Entry[]>();
    let i = 0;
    for (const p of panes) {
      const id = sessionIds[p.key];
      if (!id) continue;
      const m = use[i % use.length];
      const dp: DetachPane = {
        sessionId: id,
        title: p.name || p.tool,
        tool: p.tool,
        profile: p.profile,
        cwd: p.cwd,
        args: p.args,
        owns: true
      };
      const arr = byMon.get(m.index) ?? [];
      arr.push({ key: p.key, dp });
      byMon.set(m.index, arr);
      i++;
    }
    if (i === 0) {
      pushToast({ kind: 'info', title: t('sessions.distributeNone') });
      return;
    }
    // Open one detached grid-window per monitor; on success live-MOVE those panes out of the grid
    // (mark so their unmount doesn't kill the session — the monitor window now owns it via attach).
    const removeKeys = new Set<string>();
    const layout: Record<number, DetachPane[]> = {};
    for (const [idx, list] of byMon) {
      const ok = await openDetached(`mon-${idx}`, idx, list.map((e) => e.dp));
      if (!ok) continue; // monitor/window unavailable — leave those panes in the main grid
      for (const e of list) {
        if (e.dp.sessionId) markMoved(e.dp.sessionId);
        removeKeys.add(e.key);
      }
      // Persist the LAUNCH config (no live session id) so this monitor can be restored next launch.
      layout[idx] = list.map((e) => ({
        title: e.dp.title,
        tool: e.dp.tool,
        profile: e.dp.profile,
        cwd: e.dp.cwd,
        args: e.dp.args,
        owns: true
      }));
    }
    if (removeKeys.size) panes = panes.filter((p) => !removeKeys.has(p.key));
    if (Object.keys(layout).length) {
      try {
        localStorage.setItem(MLKEY, JSON.stringify(layout));
        savedLayoutExists = true;
      } catch {
        /* ignore */
      }
    }
  }

  // #13 — forget the saved monitor arrangement (stops the restore prompt on future launches).
  function forgetLayout() {
    try {
      localStorage.removeItem(MLKEY);
    } catch {
      /* ignore */
    }
    savedLayoutExists = false;
    pushToast({ kind: 'info', title: t('sessions.forgetLayoutDone') });
  }

  // Restore the last "разнести" arrangement: reopen a window per saved monitor and SPAWN fresh sessions
  // (the old PTYs died with the app). Skips monitors that no longer exist. Offered via a toast on launch.
  async function restoreLayout() {
    let saved: Record<number, DetachPane[]>;
    try {
      saved = JSON.parse(localStorage.getItem(MLKEY) ?? '{}');
    } catch {
      return;
    }
    invalidateMonitors(); // re-enumerate: the saved layout may target monitors that are now gone
    let mons;
    try {
      mons = await getMonitors();
    } catch {
      return;
    }
    const have = new Set(mons.map((m) => m.index));
    for (const [idxStr, list] of Object.entries(saved)) {
      const idx = Number(idxStr);
      if (!have.has(idx) || !list?.length) continue;
      await openDetached(`mon-${idx}`, idx, list);
    }
  }

  const atLimit = $derived(panes.length >= MAX_PANES);
  function rememberRecent(folder: string) {
    if (!folder) return;
    try {
      const prev: string[] = JSON.parse(localStorage.getItem('cmh-recent-folders') ?? '[]');
      const next = [folder, ...prev.filter((f) => f !== folder)].slice(0, 12);
      localStorage.setItem('cmh-recent-folders', JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }
  function addPane(v: { tool: SessionTool; profile: string; cwd: string; args: string; remoteDir?: string; sshTarget?: string; attachId?: string; ownsSession?: boolean }) {
    // Don't block re-attaching an EXISTING session (e.g. a pane returned from a monitor) on the cap —
    // it's not a new spawn. Only new spawns count against MAX_PANES.
    if (atLimit && !v.attachId) return;
    const key = `${v.tool}:${v.profile || 'sh'}#${seq++}`;
    panes = [...panes, { key, profile: v.profile, tool: v.tool, cwd: v.cwd, args: v.args, remoteDir: v.remoteDir, sshTarget: v.sshTarget, attachId: v.attachId, ownsSession: v.ownsSession }];
    if (v.tool === 'claude') rememberFolder(v.profile, v.cwd);
    rememberRecent(v.cwd);
  }
  $effect(() => {
    try {
      localStorage.setItem('cmh-sessions-launcher', launcherOpen ? '1' : '0');
    } catch {
      /* ignore */
    }
  });
  $effect(() => {
    try {
      localStorage.setItem(DAKEY, defaultArgs);
    } catch {
      /* ignore */
    }
  });
  function closePane(key: string) {
    const closed = panes.find((p) => p.key === key);
    const movedOut = peekMoved(sessionIds[key] ?? '');
    panes = panes.filter((p) => p.key !== key);
    delete paneRefs[key]; // drop the unmounted pane's ref so the map doesn't retain stale keys
    if (maximized === key) maximized = null;
    // Broadcast is meaningless with one pane and its toggle is hidden — reset so input doesn't
    // keep getting mirrored invisibly.
    if (panes.length <= 1) broadcast = false;
    // Offer a one-click reopen (same tool/profile/folder/args). The old PTY is gone, so this
    // relaunches a fresh session rather than restoring scrollback. Skip for a live MOVE — the
    // session isn't closed, it just relocated to a monitor window.
    if (closed && !movedOut) {
      pushToast({
        kind: 'info',
        title: t('sessions.paneClosed', { name: paneLabel(closed) }),
        action: {
          label: t('sessions.reopen'),
          onClick: () =>
            addPane({ tool: closed.tool, profile: closed.profile, cwd: closed.cwd, args: closed.args })
        }
      });
    }
  }
  function closeAll() {
    panes = [];
    maximized = null;
    broadcast = false;
    for (const k in paneRefs) delete paneRefs[k]; // clear all refs (const map — delete keys in place)
  }
  // Resizable columns/rows: per-track fraction weights + draggable dividers. Explicit equal
  // fractions (not grid-auto-rows) guarantee equal default sizes.
  let colFr = $state<number[]>([1, 1]);
  let rowFr = $state<number[]>([1]);
  let gridEl: HTMLDivElement | undefined = $state();
  // Never show more columns than there are panes — 1 pane with "3 columns" selected should fill
  // the row, not sit in a third of it.
  const effCols = $derived(Math.min(columns, Math.max(1, panes.length)));
  const rowCount = $derived(Math.max(1, Math.ceil(panes.length / effCols)));
  // Persisted per-column-count widths (so a manual resize survives restarts).
  const COLFR_KEY = 'cmh-sessions-colfr';
  function loadColFr(n: number): number[] | null {
    try {
      const all = JSON.parse(localStorage.getItem(COLFR_KEY) ?? '{}');
      const v = all[n];
      return Array.isArray(v) && v.length === n ? v : null;
    } catch {
      return null;
    }
  }
  function saveColFr() {
    try {
      const all = JSON.parse(localStorage.getItem(COLFR_KEY) ?? '{}');
      all[effCols] = colFr;
      localStorage.setItem(COLFR_KEY, JSON.stringify(all));
    } catch {
      /* ignore */
    }
  }
  $effect(() => {
    // Only acts when the track count changes — restores saved widths, else equal fractions.
    if (colFr.length !== effCols) colFr = loadColFr(effCols) ?? Array(effCols).fill(1);
  });
  $effect(() => {
    if (rowFr.length !== rowCount) rowFr = Array(rowCount).fill(1);
  });
  const colBounds = $derived.by(() => {
    const total = colFr.reduce((s, f) => s + f, 0) || 1;
    const out: number[] = [];
    let acc = 0;
    for (let i = 0; i < colFr.length - 1; i++) {
      acc += colFr[i];
      out.push((acc / total) * 100);
    }
    return out; // percent positions of each divider
  });
  const rowBounds = $derived.by(() => {
    const total = rowFr.reduce((s, f) => s + f, 0) || 1;
    const out: number[] = [];
    let acc = 0;
    for (let i = 0; i < rowFr.length - 1; i++) {
      acc += rowFr[i];
      out.push((acc / total) * 100);
    }
    return out;
  });
  // Shared divider drag: `axis` picks width/clientX (col) vs height/clientY (row).
  function startResize(e: PointerEvent, k: number, axis: 'col' | 'row') {
    e.preventDefault();
    const fr = axis === 'col' ? colFr : rowFr;
    const span = (axis === 'col' ? gridEl?.clientWidth : gridEl?.clientHeight) || 1;
    const total = fr.reduce((s, f) => s + f, 0);
    const start = axis === 'col' ? e.clientX : e.clientY;
    const a = fr[k];
    const b = fr[k + 1];
    const move = (ev: PointerEvent) => {
      const pos = axis === 'col' ? ev.clientX : ev.clientY;
      const dFr = ((pos - start) / span) * total;
      const next = [...(axis === 'col' ? colFr : rowFr)];
      next[k] = Math.max(0.25, a + dFr);
      next[k + 1] = Math.max(0.25, b - dFr);
      if (axis === 'col') colFr = next;
      else rowFr = next;
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      if (axis === 'col') saveColFr(); // remember manual column widths
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }

  function toggleMax(key: string) {
    maximized = maximized === key ? null : key;
  }

  // Short label for a pane (mirrors TerminalPane's title logic): the profile for Claude, else the
  // tool + the folder it runs in. Used by the maximized-mode session switcher.
  function paneLabel(p: Pane): string {
    if (p.name) return p.name;
    if (p.tool === 'claude') return p.profile || 'claude';
    const folder = p.cwd ? p.cwd.replace(/[\\/]+$/, '').split(/[\\/]/).pop() || '' : '';
    return folder ? `${p.tool} · ${folder}` : p.tool;
  }

  // ─── Settings (⚙): projects root + default args + SSH servers — all in one place, no dialogs ───
  const ROOT = 'cmh-projects-root';
  let projectsRoot = $state('');
  function openSettings() {
    launcherOpen = true;
  }
  async function browseRoot() {
    const d = await pickFolder(projectsRoot);
    if (d) {
      projectsRoot = d;
      try {
        localStorage.setItem(ROOT, d);
      } catch {
        /* ignore */
      }
    }
  }
  // Add-server form (inline in settings) — reuses the SSH host registry.
  let srvName = $state('');
  let srvTarget = $state('');
  let srvDir = $state('');
  let srvTesting = $state(false);
  let srvTest = $state<'ok' | 'fail' | null>(null);
  async function addServer() {
    const p = parseSshTarget(srvTarget);
    if (!p.host) return;
    const name = srvName.trim() || (p.user ? `${p.user}@${p.host}` : p.host);
    await saveSshHost({ id: '', name, host: p.host, port: p.port, user: p.user, keyPath: p.keyPath, remoteDir: srvDir.trim() || null, source: 'saved' });
    srvName = '';
    srvTarget = '';
    srvDir = '';
    srvTest = null;
    const list = await readSshHosts();
    sshHostList = list;
    checkReach(list);
  }
  async function deleteServer(id: string) {
    await deleteSshHost(id);
    const list = await readSshHosts();
    sshHostList = list;
  }
  async function testServer() {
    const p = parseSshTarget(srvTarget);
    if (!p.host) return;
    srvTesting = true;
    srvTest = null;
    try {
      srvTest = (await testSshHost(p.host, p.port)) ? 'ok' : 'fail';
    } catch {
      srvTest = 'fail';
    } finally {
      srvTesting = false;
    }
  }
  // SSH quick-connect dropdown: saved + ~/.ssh/config hosts → 1 click launches; "+ New SSH…" → dialog.
  let sshHostList = $state<SshHost[]>([]);
  // Auto reachability check: ping each host's port (test_ssh_host, TCP) and show a status dot.
  let sshReach = $state<Record<string, 'checking' | 'ok' | 'fail'>>({});
  async function checkReach(hosts: SshHost[]) {
    if (!hosts.length) return;
    // Probe all hosts at once (was a sequential for-await: N×2s of dots stuck on "checking"). Each
    // result lands as it returns; the `mounted` guard drops writes that resolve after a tab switch.
    sshReach = { ...sshReach, ...Object.fromEntries(hosts.map((h) => [h.id, 'checking' as const])) };
    await Promise.allSettled(
      hosts.map(async (h) => {
        const ok = await testSshHost(h.host, h.port ?? null).catch(() => false);
        if (mounted) sshReach = { ...sshReach, [h.id]: ok ? 'ok' : 'fail' };
      })
    );
  }
  // ─── Launcher: environment × location × folder × args, read as a phrase (№20 + №8) ───
  type Env = 'claude' | 'opencode' | 'shell';
  const ENVS: { id: Env; label: string; title: string; icon: string }[] = [
    {
      id: 'claude',
      label: 'Claude',
      title: t('sessions.envClaudeTip'),
      icon: '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true"><path d="M12 2l1.9 6.4a2 2 0 0 0 1.7 1.7L22 12l-6.4 1.9a2 2 0 0 0-1.7 1.7L12 22l-1.9-6.4a2 2 0 0 0-1.7-1.7L2 12l6.4-1.9a2 2 0 0 0 1.7-1.7z"/></svg>'
    },
    {
      id: 'opencode',
      label: 'opencode',
      title: t('sessions.envOpencodeTip'),
      icon: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8.5 7L4 12l4.5 5M15.5 7L20 12l-4.5 5"/></svg>'
    },
    {
      id: 'shell',
      label: 'shell',
      title: t('sessions.envShellTip'),
      icon: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 8l4 4-4 4M12 16h7"/></svg>'
    }
  ];
  let lEnv = $state<Env>('claude');
  let lProfile = $state('');
  let lLoc = $state(''); // '' = this PC; else an SSH host id
  let lFolder = $state(''); // local folder (when lLoc==='')
  let lRemoteDir = $state(''); // remote start dir (when lLoc!=='')
  let remoteRecent = $state<string[]>([]); // recent remote dirs → datalist for the remote-dir input (#19)
  let lArgs = $state('');
  // The args field mirrors the ⚙ default-args until the user edits it (then it's theirs). This is
  // what makes editing "default args" in settings actually flow into the phrase (#16 — was seeded once).
  let argsTouched = $state(false);
  $effect(() => {
    if (!argsTouched) lArgs = defaultArgs;
  });
  function rememberRemote(dir: string) {
    const d = dir.trim();
    if (!d) return;
    remoteRecent = [d, ...remoteRecent.filter((x) => x !== d)].slice(0, 10);
    try {
      localStorage.setItem(RRKEY, JSON.stringify(remoteRecent));
    } catch {
      /* ignore */
    }
  }
  const LOC_ADD = '__add__';
  const locOptions = $derived([
    { value: '', label: t('sessions.locThisPc'), icon: '💻' },
    ...sshHostList.map((h) => ({
      value: h.id,
      label: h.name,
      icon: sshReach[h.id] === 'ok' ? '🟢' : sshReach[h.id] === 'fail' ? '🔴' : '⚪',
      hint: h.source === 'sshconfig' ? '~/.ssh/config' : undefined
    })),
    { value: LOC_ADD, label: t('sessions.locAdd'), icon: '＋' }
  ]);
  function onLocChange(v: string) {
    if (v === LOC_ADD) {
      lLoc = ''; // host management (add/test/save) lives in ⚙ settings
      openSettings();
      return;
    }
    lLoc = v;
    const h = sshHostList.find((x) => x.id === v);
    if (h) lRemoteDir = h.remoteDir ?? '';
  }
  // Seed the profile dropdown with the first profile until the user picks one.
  $effect(() => {
    if (!lProfile && profiles.length) lProfile = profiles[0];
  });
  // Build addPane input from a phrase (current or a saved favorite). null = unknown SSH host.
  function paneFrom(env: Env, profile: string, locId: string, folder: string, remoteDir: string, args: string) {
    const a = env === 'shell' ? '' : args.trim();
    const prof = env === 'claude' ? profile : '';
    if (!locId) return { tool: env as SessionTool, profile: prof, cwd: folder.trim(), args: a };
    const h = sshHostList.find((x) => x.id === locId);
    if (!h) return null;
    return { tool: env as SessionTool, profile: prof, cwd: '', args: a, sshTarget: sshTarget(h), remoteDir: remoteDir.trim() || undefined };
  }
  function launchPhrase() {
    const v = paneFrom(lEnv, lProfile, lLoc, lFolder, lRemoteDir, lArgs);
    if (v) {
      if (lLoc && lRemoteDir.trim()) rememberRemote(lRemoteDir); // SSH: keep the remote dir for next time
      addPane(v);
    }
  }
  // ─── Favorites: pin the whole phrase → 1-click relaunch ───
  type Fav = { id: string; env: Env; profile: string; locId: string; folder: string; remoteDir: string; args: string; label: string };
  const VKEY = 'cmh-sessions-favorites';
  let favorites = $state<Fav[]>([]);
  function favLabel(env: Env, profile: string, locId: string, folder: string): string {
    const h = locId ? sshHostList.find((x) => x.id === locId) : null;
    const where = h
      ? `🖥 ${h.name}`
      : folder
        ? folder.replace(/[\\/]+$/, '').split(/[\\/]/).pop() || folder
        : t('sessions.cwdShort');
    return env === 'claude' ? `${env}·${profile} · ${where}` : `${env} · ${where}`;
  }
  function pinCurrent() {
    const id = `f${Date.now()}${Math.round(Math.random() * 1e4)}`;
    const label = favLabel(lEnv, lProfile, lLoc, lFolder);
    favorites = [
      ...favorites,
      { id, env: lEnv, profile: lProfile, locId: lLoc, folder: lFolder, remoteDir: lRemoteDir, args: lEnv === 'shell' ? '' : lArgs, label }
    ];
    pushToast({ kind: 'success', title: t('sessions.pinned', { label }) }); // feedback — pinning was silent (#17)
  }
  function launchFav(f: Fav) {
    const v = paneFrom(f.env, f.profile, f.locId, f.folder, f.remoteDir, f.args);
    if (v) addPane(v);
  }
  function removeFav(id: string) {
    favorites = favorites.filter((f) => f.id !== id);
  }
  $effect(() => {
    try {
      localStorage.setItem(VKEY, JSON.stringify(favorites));
    } catch {
      /* ignore */
    }
  });
  // Deep-link (e.g. from a fork card's "Terminal"): prefill the phrase with that repo folder (local).
  $effect(() => {
    const f = folderReq;
    if (f != null) {
      lLoc = '';
      lFolder = f;
      onFolderReqConsumed?.();
    }
  });

  function duplicate(key: string) {
    const p = panes.find((x) => x.key === key);
    if (p) addPane({ tool: p.tool, profile: p.profile, cwd: p.cwd, args: p.args, remoteDir: p.remoteDir, sshTarget: p.sshTarget });
  }

  // Drag a pane's title bar over another to reorder (live, as you hover).
  let dragKey = $state<string | null>(null);
  function onDragStart(key: string) {
    dragKey = key;
  }
  function onDragEnter(targetKey: string) {
    if (!dragKey || dragKey === targetKey || maximized) return;
    const from = panes.findIndex((p) => p.key === dragKey);
    const to = panes.findIndex((p) => p.key === targetKey);
    if (from < 0 || to < 0) return;
    const next = [...panes];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    panes = next;
  }
  function onDrop() {
    dragKey = null;
  }

  // Tab-scoped shortcuts (only while the Sessions tab is shown): Ctrl+T new session, Alt+1/2/3 cols.
  // Pane component refs, so a shortcut can move focus between terminals (and the tab can drive
  // search/zoom across every pane at once).
  type PaneApi = {
    focusTerminal: () => void;
    runExternalSearch: (q: string, next?: boolean) => void;
    setFontSize: (px: number) => void;
  };
  const paneRefs: Record<string, PaneApi | undefined> = {};
  let focusIdx = 0;

  // Search every pane at once (#52). Each pane runs the query through its own SearchAddon;
  // next=false steps to the previous match.
  let searchAllText = $state('');
  function searchAll(next = true) {
    for (const k in paneRefs) paneRefs[k]?.runExternalSearch(searchAllText, next);
  }
  // Debounce the per-keystroke incremental scan (#Fsess-09): each call fans a full-buffer
  // SearchAddon scan across every pane (scrollback up to 50k lines), so fast typing with several
  // panes open fires N heavy searches per character. Enter/arrow buttons still search immediately.
  let searchAllTimer: ReturnType<typeof setTimeout> | undefined;
  function searchAllDebounced() {
    clearTimeout(searchAllTimer);
    searchAllTimer = setTimeout(() => searchAll(true), 150);
  }

  // Synced zoom: push one font size to every pane (#60). Persisted in the shared font key so new
  // panes open at the same size.
  let globalFont = $state(13);
  function zoomAll(delta: number) {
    globalFont = Math.min(28, Math.max(8, globalFont + delta));
    for (const k in paneRefs) paneRefs[k]?.setFontSize(globalFont);
  }

  // Focus mode (#61): dim every pane except the hovered one (for screencasts) — pure CSS, no
  // tracking of which terminal holds keyboard focus.
  let focusMode = $state(false);
  function cycleFocus(dir: 1 | -1) {
    const list = maximized ? panes.filter((p) => p.key === maximized) : panes;
    if (!list.length) return;
    focusIdx = (focusIdx + dir + list.length) % list.length;
    paneRefs[list[focusIdx].key]?.focusTerminal();
  }
  function onKey(e: KeyboardEvent) {
    if (!visible) return;
    if (e.ctrlKey && !e.shiftKey && (e.key === 't' || e.key === 'T')) {
      e.preventDefault();
      launchPhrase();
    } else if (e.altKey && (e.key === '1' || e.key === '2' || e.key === '3')) {
      e.preventDefault();
      columns = Number(e.key);
    } else if (e.ctrlKey && (e.key === ']' || e.key === '[')) {
      // Ctrl+] / Ctrl+[ — focus next / previous pane terminal.
      e.preventDefault();
      cycleFocus(e.key === ']' ? 1 : -1);
    }
  }

  // ── Workspaces: save the current set of panes under a name, re-launch it later ──
  let savingWs = $state(false);
  let wsName = $state('');
  const wsNames = $derived(Object.keys(workspaces));
  function persistWs() {
    try {
      localStorage.setItem(WKEY, JSON.stringify(workspaces));
    } catch {
      /* ignore */
    }
  }
  function saveWorkspace() {
    const name = wsName.trim();
    if (!name || !panes.length) return;
    workspaces = {
      ...workspaces,
      [name]: panes.map((p) => ({ tool: p.tool, profile: p.profile, cwd: p.cwd, args: p.args, remoteDir: p.remoteDir, sshTarget: p.sshTarget }))
    };
    persistWs();
    savingWs = false;
    wsName = '';
  }
  function launchWorkspace(name: string) {
    for (const c of workspaces[name] ?? []) addPane(c);
  }
  function deleteWorkspace(name: string) {
    const { [name]: _drop, ...rest } = workspaces;
    workspaces = rest;
    persistWs();
  }
</script>

<svelte:window onkeydown={onKey} />

<div class="wrap">
  <header class="mb-sw-3 flex items-center justify-between gap-sw-4">
    <div class="flex items-baseline gap-sw-3 min-w-0">
      <h1 class="text-lg font-semibold">{t('sessions.title')}</h1>
      <p class="truncate text-sw-xs text-sw-text-muted">{t('sessions.subtitle')}</p>
    </div>
    <div class="flex shrink-0 items-center gap-sw-2">
      {#if panes.length > 1}
        <input class="sw-input text-sw-xs" style="width:120px" bind:value={searchAllText}
          placeholder={t('sessions.searchAllPlaceholder')} title={t('sessions.searchAllTip')} spellcheck="false"
          oninput={searchAllDebounced} onkeydown={(e) => e.key === 'Enter' && searchAll(!e.shiftKey)} />
        <button class="sw-btn sw-btn-ghost text-sw-xs" onclick={() => searchAll(false)} title={t('sessions.findPrev')} aria-label={t('sessions.findPrev')}>↑</button>
        <button class="sw-btn sw-btn-ghost text-sw-xs" onclick={() => searchAll(true)} title={t('sessions.findNext')} aria-label={t('sessions.findNext')}>↓</button>
        <input class="sw-input text-sw-xs" style="width:130px" bind:value={sendAllText}
          placeholder={t('sessions.sendAllPlaceholder')} title={t('sessions.sendAllTip')} spellcheck="false"
          onkeydown={(e) => e.key === 'Enter' && sendToAll()} />
        <span class="text-sw-text-muted">·</span>
        <label class="flex cursor-pointer items-center gap-1" title={t('sessions.broadcastTip')}>
          <Toggle bind:checked={broadcast} />
          <span class="text-sw-xs" class:text-sw-text={broadcast} class:text-sw-text-secondary={!broadcast}>{t('sessions.broadcast')}</span>
        </label>
        <span class="text-sw-text-muted">·</span>
      {/if}
      {#if panes.length}
        <button class="sw-btn sw-btn-ghost text-sw-xs" onclick={() => zoomAll(-1)} title={t('sessions.zoomAllOut')} aria-label={t('sessions.zoomAllOut')}>A−</button>
        <button class="sw-btn sw-btn-ghost text-sw-xs" onclick={() => zoomAll(1)} title={t('sessions.zoomAllIn')} aria-label={t('sessions.zoomAllIn')}>A+</button>
        <button class="sw-btn sw-btn-ghost text-sw-xs" class:active={focusMode} onclick={() => (focusMode = !focusMode)}
          title={t('sessions.focusModeTip')} aria-pressed={focusMode}>◎</button>
        <button class="sw-btn sw-btn-ghost text-sw-xs" onclick={distributeToMonitors}
          title={t('sessions.distributeTip')} aria-label={t('sessions.distribute')}>⬈⬈</button>
        <span class="text-sw-text-muted">·</span>
      {/if}
      {#if savedLayoutExists}
        <button class="sw-btn sw-btn-ghost text-sw-xs" onclick={forgetLayout}
          title={t('sessions.forgetLayoutTip')} aria-label={t('sessions.forgetLayout')}>↺✕</button>
        <span class="text-sw-text-muted">·</span>
      {/if}
      <span class="text-sw-xs text-sw-text-muted">{t('sessions.layout')}</span>
      {#each [1, 2, 3] as c (c)}
        <button class="sw-btn sw-btn-ghost text-sw-xs" class:active={columns === c} onclick={() => (columns = c)}
          title="{t('sessions.layoutCols', { n: c })} · Alt+{c}">{c}</button>
      {/each}
      {#if panes.length}
        <button class="sw-btn sw-btn-ghost text-sw-xs" onclick={closeAll} title={t('sessions.closeAllTip')}>
          {t('sessions.closeAll')}
        </button>
      {/if}
    </div>
  </header>

  <!-- Launcher: environment × location × folder × args, read as a phrase (№20 + №8) -->
  <div class="launcher">
    <div class="launchhead">
      <div class="envseg" role="tablist" aria-label={t('sessions.dlgTool')}>
        {#each ENVS as e (e.id)}
          <button type="button" class="env-btn" class:sel={lEnv === e.id} onclick={() => (lEnv = e.id)}
            title={e.title} role="tab" aria-selected={lEnv === e.id}>
            <span class="env-ic">{@html e.icon}</span>{e.label}
          </button>
        {/each}
      </div>
      <button class="sw-btn sw-btn-ghost text-sw-xs" class:active={launcherOpen}
        onclick={() => (launcherOpen = !launcherOpen)} title={t('sessions.settingsTip')} aria-pressed={launcherOpen}>⚙ {t('sessions.settings')}</button>
    </div>

    <!-- The phrase: reads as a sentence and adapts to the chosen environment / location -->
    <div class="phrase">
      <span class="pw">{t('sessions.phRun')}</span>
      {#if lEnv === 'claude'}
        <span class="pw">{t('sessions.phProfile')}</span>
        <div class="psel"><Select bind:value={lProfile} options={profiles} placeholder={t('sessions.dlgProfile')} /></div>
      {/if}
      <span class="pw">{t('sessions.phOn')}</span>
      <div class="psel"><Select value={lLoc} onChange={onLocChange} options={locOptions} placeholder={t('sessions.locThisPc')} /></div>
      <span class="pw">{t('sessions.phIn')}</span>
      {#if lLoc === ''}
        <div class="pfolder"><FolderField bind:value={lFolder} placeholder={t('sessions.cwdShort')} /></div>
      {:else}
        <input class="sw-input grow font-mono text-sw-xs pfolder" bind:value={lRemoteDir}
          list="remote-dirs" placeholder={t('sessions.dlgSshRemoteDirPlaceholder')} spellcheck="false" autocomplete="off" />
        <datalist id="remote-dirs">
          {#each remoteRecent as d (d)}<option value={d}></option>{/each}
        </datalist>
      {/if}
      {#if lEnv !== 'shell'}
        <span class="pw">{t('sessions.phWith')}</span>
        <input class="sw-input grow font-mono text-sw-xs pargs" bind:value={lArgs} oninput={() => (argsTouched = true)}
          placeholder={t('sessions.dlgArgsPlaceholder')} spellcheck="false" autocomplete="off" />
      {/if}
      {#if lLoc && lEnv !== 'shell'}
        <span class="ssh-hint" title={t('sessions.sshToolHint', { tool: lEnv })}>{t('sessions.sshToolHint', { tool: lEnv })}</span>
      {/if}
      <button type="button" class="sw-btn sw-btn-ghost star" onclick={pinCurrent} title={t('sessions.pin')} aria-label={t('sessions.pin')}>★</button>
      <button type="button" class="sw-btn sw-btn-primary text-sw-xs" onclick={launchPhrase} title="{t('sessions.phLaunch')} · Ctrl+T">▶ {t('sessions.phLaunch')}</button>
    </div>

    <!-- Favorites (pinned phrases) + save-workspace -->
    {#if favorites.length || panes.length || savingWs}
      <div class="favs">
        {#if favorites.length}
          <span class="text-sw-xs text-sw-text-muted">★</span>
          {#each favorites as f (f.id)}
            <span class="fav-chip">
              <button type="button" class="fav-go" onclick={() => launchFav(f)} title={t('sessions.favLaunchTip')}>{f.label}</button>
              <button type="button" class="fav-x" onclick={() => removeFav(f.id)} title={t('common.delete')} aria-label={t('common.delete')}>✕</button>
            </span>
          {/each}
          <span class="text-sw-text-muted">·</span>
        {/if}
        {#if savingWs}
          <input class="sw-input text-sw-xs" style="width:160px" bind:value={wsName} placeholder={t('sessions.wsNamePlaceholder')}
            onkeydown={(e) => e.key === 'Enter' && saveWorkspace()} />
          <button class="sw-btn sw-btn-primary text-sw-xs" disabled={!wsName.trim() || !panes.length} onclick={saveWorkspace}>{t('common.save')}</button>
          <button class="sw-btn sw-btn-ghost text-sw-xs" onclick={() => (savingWs = false)}>{t('common.cancel')}</button>
        {:else}
          <button class="sw-btn sw-btn-ghost text-sw-xs" disabled={!panes.length} onclick={() => (savingWs = true)}
            title={t('sessions.wsSaveTip')}>{t('sessions.wsSave')}</button>
        {/if}
      </div>
    {/if}

    <!-- Settings (⚙): projects root + default args + SSH servers — everything configurable, no dialogs -->
    {#if launcherOpen}
      <div class="settings">
        <div class="set-row">
          <span class="set-k" title={t('sessions.projectsRootHint')}>{t('sessions.projectsRoot')}</span>
          <input class="sw-input grow font-mono text-sw-xs" bind:value={projectsRoot}
            placeholder={t('sessions.projectsRootPlaceholder')} spellcheck="false" autocomplete="off"
            onchange={() => { try { localStorage.setItem(ROOT, projectsRoot); } catch { /* ignore */ } }} />
          <button class="sw-btn sw-btn-ghost text-sw-xs" onclick={browseRoot}>📁 {t('sessions.browse')}</button>
        </div>
        <div class="set-row">
          <span class="set-k" title={t('sessions.defaultArgsHint')}>{t('sessions.defaultArgs')}</span>
          <input class="sw-input grow font-mono text-sw-xs" bind:value={defaultArgs}
            placeholder={t('sessions.dlgArgsPlaceholder')} spellcheck="false" autocomplete="off" />
          {#each ARG_PRESETS.claude as flag (flag)}
            <button type="button" class="argchip" class:on={defaultArgs.includes(flag)}
              onclick={() => (defaultArgs = toggleFlag(defaultArgs, flag))}>{flag}</button>
          {/each}
        </div>
        <div class="set-srv">
          <span class="set-k">{t('sessions.servers')}</span>
          <div class="srv-list">
            {#each sshHostList as h (h.id)}
              <span class="srv-chip">
                <span>{sshReach[h.id] === 'ok' ? '🟢' : sshReach[h.id] === 'fail' ? '🔴' : '⚪'}</span>
                <span class="srv-n">{h.name}</span>
                <span class="srv-t font-mono">{sshTarget(h)}</span>
                {#if h.source === 'saved'}
                  <button class="srv-x" onclick={() => deleteServer(h.id)} title={t('common.delete')} aria-label={t('common.delete')}>✕</button>
                {:else}
                  <span class="srv-cfg">~/.ssh/config</span>
                {/if}
              </span>
            {/each}
            {#if !sshHostList.length}<span class="text-sw-xs text-sw-text-muted">{t('sessions.dlgSshEmpty')}</span>{/if}
          </div>
          <div class="srv-add">
            <input class="sw-input text-sw-xs" style="width:130px" bind:value={srvName} placeholder={t('sessions.dlgSshName')} spellcheck="false" autocomplete="off" />
            <input class="sw-input grow font-mono text-sw-xs" bind:value={srvTarget} placeholder={t('sessions.dlgSshTargetPlaceholder')} spellcheck="false" autocomplete="off" />
            <input class="sw-input font-mono text-sw-xs" style="width:170px" bind:value={srvDir} placeholder={t('sessions.dlgSshRemoteDir')} spellcheck="false" autocomplete="off" />
            <button class="sw-btn sw-btn-ghost text-sw-xs" disabled={!srvTarget.trim() || srvTesting} onclick={testServer}>{t('sessions.dlgSshTest')}</button>
            {#if srvTest === 'ok'}<span class="text-sw-xs" style="color:#3fb950">✓ {t('sessions.dlgSshTestOk')}</span>{/if}
            {#if srvTest === 'fail'}<span class="text-sw-xs" style="color:var(--sw-danger)">✕ {t('sessions.dlgSshTestFail')}</span>{/if}
            <button class="sw-btn sw-btn-primary text-sw-xs" disabled={!srvTarget.trim()} onclick={addServer}>{t('sessions.serverAdd')}</button>
          </div>
        </div>
      </div>
    {/if}
  </div>

  {#if atLimit}
    <p class="mb-sw-2 text-sw-xs" style="color:var(--sw-warn)">{t('sessions.limitNote', { n: MAX_PANES })}</p>
  {/if}

  <!-- Saved workspaces: one click re-opens the whole set of sessions -->
  {#if wsNames.length}
    <div class="workspaces">
      <span class="text-sw-xs text-sw-text-muted">{t('sessions.wsLabel')}</span>
      {#each wsNames as name (name)}
        <span class="ws-chip">
          <button class="ws-go" onclick={() => launchWorkspace(name)} title={t('sessions.wsLaunchTip', { name })}>
            ▶ {name} ({workspaces[name].length})
          </button>
          <button class="ws-del" onclick={() => deleteWorkspace(name)} title={t('sessions.wsDeleteTip', { name })} aria-label="✕">✕</button>
        </span>
      {/each}
    </div>
  {/if}

  <!-- While one pane is maximized the others are hidden; this switcher keeps them visible and
       one-click reachable so you never lose track of running sessions. -->
  {#if maximized}
    <div class="maxbar">
      {#each panes as p (p.key)}
        <button class="maxchip" class:active={maximized === p.key}
          onclick={() => { maximized = p.key; unread = { ...unread, [p.key]: false }; }} title={paneLabel(p)}>
          <span class="maxchip-dot" class:unread={unread[p.key] && maximized !== p.key}></span>{paneLabel(p)}
        </button>
      {/each}
      <span class="spacer"></span>
      <button class="sw-btn sw-btn-ghost text-sw-xs" onclick={() => { maximized = null; unread = {}; }}>⤡ {t('sessions.restore')}</button>
    </div>
  {/if}

  {#if panes.length}
    <div
      class="grid"
      class:focus-dim={focusMode && !maximized}
      bind:this={gridEl}
      style="grid-template-columns: {maximized ? '1fr' : colFr.map((f) => `minmax(0, ${f}fr)`).join(' ')}; grid-template-rows: {maximized ? '1fr' : rowFr.map((f) => `minmax(80px, ${f}fr)`).join(' ')};"
    >
      <!-- Every pane stays MOUNTED (sessions must survive maximize); non-maximized ones are just
           hidden, so the maximized pane fills the single column. -->
      {#each panes as pane (pane.key)}
        <div class="cell" class:hidden={maximized != null && maximized !== pane.key}>
          <TerminalPane
            bind:this={paneRefs[pane.key]}
            profile={pane.profile}
            tool={pane.tool}
            args={pane.args}
            cwd={pane.cwd || undefined}
            remoteDir={pane.remoteDir}
            sshTarget={pane.sshTarget}
            attachId={pane.attachId}
            ownsSession={pane.ownsSession ?? false}
            paneKey={pane.key}
            visible={visible && (maximized == null || maximized === pane.key)}
            maximized={maximized === pane.key}
            {broadcast}
            onInput={broadcastInput}
            {onIdChange}
            {onActivity}
            displayName={pane.name ?? ''}
            onRename={renamePane}
            onNewSession={launchPhrase}
            onClose={() => closePane(pane.key)}
            onToggleMax={() => toggleMax(pane.key)}
            onDuplicate={() => duplicate(pane.key)}
            {onDragStart}
            {onDragEnter}
            {onDrop}
          />
        </div>
      {/each}
      {#if !maximized}
        {#each colBounds as pos, k (k)}
          <button type="button" class="divider col-divider" style="left:{pos}%"
            title={t('sessions.resizeCol')} aria-label={t('sessions.resizeCol')}
            onpointerdown={(e) => startResize(e, k, 'col')}></button>
        {/each}
        {#each rowBounds as pos, k (k)}
          <button type="button" class="divider row-divider" style="top:{pos}%"
            title={t('sessions.resizeRow')} aria-label={t('sessions.resizeRow')}
            onpointerdown={(e) => startResize(e, k, 'row')}></button>
        {/each}
      {/if}
    </div>
  {:else}
    <div class="empty">
      <div class="empty-icon">▦</div>
      <div class="font-medium text-sw-text">{t('sessions.emptyTitle')}</div>
      <div class="text-sw-sm text-sw-text-muted">{t('sessions.emptyHint')}</div>
      <button class="sw-btn sw-btn-primary text-sw-xs mt-sw-2" onclick={launchPhrase} title={t('sessions.phLaunch')}>
        ▶ {t('sessions.phLaunch')}
      </button>
    </div>
  {/if}
</div>

<style>
  .wrap {
    padding: var(--sw-space-4) var(--sw-space-6) var(--sw-space-3);
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
  }
  .launcher {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: var(--sw-space-3);
    margin-bottom: var(--sw-space-4);
    padding-bottom: var(--sw-space-3);
    border-bottom: 1px solid var(--sw-border);
  }
  .launchhead {
    display: flex;
    align-items: center;
    gap: var(--sw-space-2);
  }
  .envseg {
    display: inline-flex;
    border: 1px solid var(--sw-border);
    border-radius: var(--sw-radius-md);
    overflow: hidden;
    margin-right: auto;
  }
  .env-btn {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    padding: 8px 16px;
    border: none;
    border-right: 1px solid var(--sw-border);
    background: transparent;
    color: var(--sw-text-secondary);
    font-size: var(--sw-text-sm);
    font-weight: 500;
    cursor: pointer;
  }
  .env-btn:last-child {
    border-right: none;
  }
  .env-btn:hover {
    background: var(--sw-bg-hover);
    color: var(--sw-text-primary);
  }
  .env-btn.sel {
    background: var(--sw-accent-glow);
    color: var(--sw-accent-text);
  }
  .env-ic {
    display: inline-flex;
    opacity: 0.9;
  }
  .phrase {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 7px;
    padding: 10px 12px;
    background: var(--sw-bg-secondary);
    border: 1px solid var(--sw-border);
    border-radius: var(--sw-radius-md);
  }
  .phrase .pw {
    color: var(--sw-text-muted);
    font-size: var(--sw-text-xs);
  }
  .phrase .psel {
    min-width: 140px;
  }
  .phrase .pfolder {
    min-width: 200px;
    flex: 1;
  }
  .phrase .pargs {
    min-width: 160px;
    flex: 1;
  }
  .phrase .ssh-hint {
    flex-basis: 100%;
    font-size: var(--sw-text-xs);
    color: var(--sw-text-muted);
    opacity: 0.85;
  }
  .phrase .star {
    margin-left: auto;
    color: var(--sw-warn);
    font-size: 15px;
    line-height: 1;
    padding: 6px 9px;
  }
  .favs {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--sw-space-2);
  }
  .fav-chip {
    display: inline-flex;
    align-items: center;
    border: 1px solid var(--sw-accent-text);
    background: var(--sw-accent-glow);
    border-radius: 9999px;
    overflow: hidden;
  }
  .fav-go {
    border: none;
    background: transparent;
    color: var(--sw-text-primary);
    cursor: pointer;
    padding: 3px 10px;
    font-size: var(--sw-text-xs);
    white-space: nowrap;
  }
  .fav-go:hover {
    color: var(--sw-accent-text);
  }
  .fav-x {
    border: none;
    background: transparent;
    color: var(--sw-text-muted);
    cursor: pointer;
    padding: 3px 7px;
    font-size: 10px;
    border-left: 1px solid var(--sw-border);
  }
  .fav-x:hover {
    color: var(--sw-danger);
  }
  .workspaces {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--sw-space-2);
    margin-bottom: var(--sw-space-3);
  }
  .settings {
    display: flex;
    flex-direction: column;
    gap: var(--sw-space-2);
    padding: 10px 12px;
    background: var(--sw-bg-secondary);
    border: 1px solid var(--sw-border);
    border-radius: var(--sw-radius-md);
  }
  .set-row,
  .srv-add {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--sw-space-2);
  }
  .set-srv {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding-top: 8px;
    border-top: 1px solid var(--sw-border);
  }
  .set-k {
    flex-shrink: 0;
    width: 130px;
    font-size: var(--sw-text-xs);
    color: var(--sw-text-muted);
  }
  .srv-list {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .srv-chip {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    padding: 3px 4px 3px 9px;
    border: 1px solid var(--sw-border);
    border-radius: 9999px;
    font-size: var(--sw-text-xs);
  }
  .srv-n {
    color: var(--sw-text-primary);
  }
  .srv-t {
    color: var(--sw-text-muted);
    font-size: 11px;
  }
  .srv-cfg {
    color: var(--sw-text-muted);
    font-size: 10px;
    padding-right: 6px;
  }
  .srv-x {
    border: none;
    background: transparent;
    color: var(--sw-text-muted);
    cursor: pointer;
    padding: 2px 6px;
    font-size: 10px;
    border-left: 1px solid var(--sw-border);
  }
  .srv-x:hover {
    color: var(--sw-danger);
  }
  .argchip {
    padding: 3px 8px;
    border: 1px solid var(--sw-border);
    border-radius: 9999px;
    background: transparent;
    color: var(--sw-text-muted);
    font-family: 'Cascadia Code', 'Consolas', monospace;
    font-size: 11px;
    cursor: pointer;
    white-space: nowrap;
  }
  .argchip:hover {
    color: var(--sw-text-secondary);
  }
  .argchip.on {
    background: var(--sw-accent-glow);
    color: var(--sw-text-primary);
    border-color: var(--sw-accent-text);
  }
  .ws-chip {
    display: inline-flex;
    align-items: center;
    border: 1px solid var(--sw-border);
    border-radius: 9999px;
    overflow: hidden;
  }
  .ws-go {
    border: none;
    background: transparent;
    color: var(--sw-text-secondary);
    cursor: pointer;
    padding: 3px 8px;
    font-size: var(--sw-text-xs);
  }
  .ws-go:hover {
    color: var(--sw-text-primary);
    background: var(--sw-accent-glow);
  }
  .ws-del {
    border: none;
    background: transparent;
    color: var(--sw-text-muted);
    cursor: pointer;
    padding: 3px 6px;
    font-size: 10px;
    border-left: 1px solid var(--sw-border);
  }
  .ws-del:hover {
    color: var(--sw-danger);
  }
  .maxbar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--sw-space-2);
    margin-bottom: var(--sw-space-2);
  }
  .maxbar .spacer {
    flex: 1;
  }
  .maxchip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    max-width: 220px;
    padding: 3px 10px;
    border: 1px solid var(--sw-border);
    border-radius: 9999px;
    background: transparent;
    color: var(--sw-text-secondary);
    font-size: var(--sw-text-xs);
    cursor: pointer;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .maxchip:hover {
    color: var(--sw-text-primary);
    background: var(--sw-accent-glow);
  }
  .maxchip.active {
    border-color: var(--sw-accent);
    color: var(--sw-accent-text);
    background: var(--sw-accent-glow);
  }
  .maxchip-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--sw-status-up);
    flex-shrink: 0;
  }
  /* Pane printed something while it was off-screen — draw attention. */
  .maxchip-dot.unread {
    background: var(--sw-warn);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--sw-warn) 30%, transparent);
  }
  .cell {
    min-height: 0;
    min-width: 0;
    display: flex;
  }
  .cell.hidden {
    display: none;
  }
  /* Focus mode: dim every pane except the one under the cursor (for screencasts). */
  .grid.focus-dim .cell {
    transition: opacity 0.15s;
  }
  .grid.focus-dim .cell:not(:hover) {
    opacity: 0.3;
  }
  .divider {
    position: absolute;
    border: none;
    background: transparent;
    z-index: 4;
    padding: 0;
  }
  .divider::after {
    content: '';
    position: absolute;
    background: var(--sw-border);
    transition: background 0.12s;
  }
  .divider:hover::after {
    background: var(--sw-accent-text);
  }
  .col-divider {
    top: 0;
    bottom: 0;
    width: 10px;
    transform: translateX(-50%);
    cursor: col-resize;
  }
  .col-divider::after {
    left: 50%;
    top: 0;
    bottom: 0;
    width: 2px;
    transform: translateX(-50%);
  }
  .row-divider {
    left: 0;
    right: 0;
    height: 10px;
    transform: translateY(-50%);
    cursor: row-resize;
  }
  .row-divider::after {
    top: 50%;
    left: 0;
    right: 0;
    height: 2px;
    transform: translateY(-50%);
  }
  .grid {
    position: relative;
    display: grid;
    gap: var(--sw-space-3);
    flex: 1;
    min-height: 0;
    /* Explicit equal grid-template-rows are set inline (equal default + resizable). This is just a
       fallback for any unexpected implicit row. */
    grid-auto-rows: minmax(80px, 1fr);
    overflow: hidden;
    padding-bottom: var(--sw-space-2);
  }
  .empty {
    flex: 1;
    display: grid;
    place-content: center;
    text-align: center;
    gap: 4px;
    color: var(--sw-text-muted);
  }
  .empty-icon {
    font-size: 2rem;
    opacity: 0.5;
  }
  .active {
    background: var(--sw-accent-glow);
    color: var(--sw-text-primary);
  }
</style>
