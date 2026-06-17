<script lang="ts">
  import { onMount } from 'svelte';
  import TerminalPane from './TerminalPane.svelte';
  import SessionLaunchDialog from './SessionLaunchDialog.svelte';
  import FolderField from './FolderField.svelte';
  import Toggle from './Toggle.svelte';
  import { t } from '$lib/i18n';
  import { pickFolder, sessionWrite, type SessionTool } from '$lib/ipc';
  import { ARG_PRESETS, toggleFlag } from '$lib/sessionPresets';

  const MAX_PANES = 12; // each pane is a pwsh+tool process — cap to keep the machine responsive

  let { profiles = [], visible = true }: { profiles?: string[]; visible?: boolean } = $props();

  type Pane = { key: string; profile: string; tool: SessionTool; cwd: string; args: string; name?: string };
  function renamePane(key: string, name: string) {
    panes = panes.map((p) => (p.key === key ? { ...p, name: name || undefined } : p));
  }
  // The key (not the profile) identifies a pane, so the same profile can run in several at once.
  let panes = $state<Pane[]>([]);
  let seq = 0;
  let columns = $state(2);
  let cwd = $state(''); // default folder for quick launches
  let maximized = $state<string | null>(null); // key of the pane shown full-screen, or null

  // Persisted prefs: column count + last folder used per profile (so re-launching a profile lands
  // in the same place).
  const FKEY = 'cmh-sessions-folders';
  const CKEY = 'cmh-sessions-cols';
  const WKEY = 'cmh-sessions-workspaces';
  const AKEY = 'cmh-sessions-askfolder';
  const DAKEY = 'cmh-sessions-defargs';
  let lastFolders = $state<Record<string, string>>({});
  // Default launch args applied to Claude quick-launches (profile buttons + "launch all").
  let defaultArgs = $state('');
  // When ON, a quick profile launch opens the folder picker first (ask every time).
  let askFolder = $state(false);
  // A workspace is a named set of session configs you can re-launch with one click.
  type WsConfig = { tool: SessionTool; profile: string; cwd: string; args: string };
  let workspaces = $state<Record<string, WsConfig[]>>({});
  onMount(() => {
    try {
      lastFolders = JSON.parse(localStorage.getItem(FKEY) ?? '{}');
      workspaces = JSON.parse(localStorage.getItem(WKEY) ?? '{}');
      askFolder = localStorage.getItem(AKEY) === '1';
      defaultArgs = localStorage.getItem(DAKEY) ?? '';
      const c = Number(localStorage.getItem(CKEY));
      if (c >= 1 && c <= 3) columns = c;
    } catch {
      /* first run / private mode */
    }
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
  function addPane(v: { tool: SessionTool; profile: string; cwd: string; args: string }) {
    if (atLimit) return;
    const key = `${v.tool}:${v.profile || 'sh'}#${seq++}`;
    panes = [...panes, { key, profile: v.profile, tool: v.tool, cwd: v.cwd, args: v.args }];
    if (v.tool === 'claude') rememberFolder(v.profile, v.cwd);
    rememberRecent(v.cwd);
  }
  $effect(() => {
    try {
      localStorage.setItem(AKEY, askFolder ? '1' : '0');
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
  // Quick launch: Claude under a profile. With "ask folder" on, prompt for the folder first
  // (cancel = don't launch); otherwise use the profile's remembered folder (or the default).
  async function quick(profile: string) {
    let dir = lastFolders[profile] ?? cwd;
    // Only prompt when "ask folder" is on AND there's no folder to fall back to — a filled
    // default/remembered folder is used directly (no redundant dialog).
    if (askFolder && !dir.trim()) {
      const picked = await pickFolder(dir);
      if (picked === null) return; // cancelled
      dir = picked;
    }
    addPane({ tool: 'claude', profile, cwd: dir, args: defaultArgs.trim() });
  }
  async function launchAll() {
    // Each profile starts in ITS OWN remembered folder (falling back to the default) — launching
    // every profile from one shared folder is almost never what you want. For an explicit
    // per-profile folder choice in one action, use the matrix dialog (folder icon next to the
    // button).
    for (const p of profiles) addPane({ tool: 'claude', profile: p, cwd: lastFolders[p] ?? cwd, args: defaultArgs.trim() });
  }
  // Quick-launch opencode or a bare shell (no profile). Respects the ask-folder toggle.
  async function quickTool(tool: 'opencode' | 'shell') {
    let dir = cwd;
    if (askFolder && !dir.trim()) {
      const picked = await pickFolder(dir);
      if (picked === null) return;
      dir = picked;
    }
    addPane({ tool, profile: '', cwd: dir, args: '' });
  }
  function closePane(key: string) {
    panes = panes.filter((p) => p.key !== key);
    if (maximized === key) maximized = null;
    // Broadcast is meaningless with one pane and its toggle is hidden — reset so input doesn't
    // keep getting mirrored invisibly.
    if (panes.length <= 1) broadcast = false;
  }
  function closeAll() {
    panes = [];
    maximized = null;
    broadcast = false;
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

  // Launch dialog (tool / profile / folder / args).
  let dlgOpen = $state(false);
  let dlgProfile = $state('');
  function openDlg(profile = '') {
    dlgProfile = profile;
    dlgOpen = true;
  }
  function onDlgSubmit(v: { tool: SessionTool; profile: string; cwd: string; args: string }) {
    dlgOpen = false;
    addPane(v);
  }

  function duplicate(key: string) {
    const p = panes.find((x) => x.key === key);
    if (p) addPane({ tool: p.tool, profile: p.profile, cwd: p.cwd, args: p.args });
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
  // Pane component refs, so a shortcut can move focus between terminals.
  const paneRefs: Record<string, { focusTerminal: () => void } | undefined> = {};
  let focusIdx = 0;
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
      openDlg();
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
      [name]: panes.map((p) => ({ tool: p.tool, profile: p.profile, cwd: p.cwd, args: p.args }))
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
        <input class="sw-input text-sw-xs" style="width:150px" bind:value={sendAllText}
          placeholder={t('sessions.sendAllPlaceholder')} title={t('sessions.sendAllTip')} spellcheck="false"
          onkeydown={(e) => e.key === 'Enter' && sendToAll()} />
        <span class="text-sw-text-muted">·</span>
        <label class="flex cursor-pointer items-center gap-1" title={t('sessions.broadcastTip')}>
          <Toggle bind:checked={broadcast} />
          <span class="text-sw-xs" class:text-sw-text-primary={broadcast} class:text-sw-text-secondary={!broadcast}>{t('sessions.broadcast')}</span>
        </label>
        <span class="text-sw-text-muted">·</span>
      {/if}
      <span class="text-sw-xs text-sw-text-muted">{t('sessions.layout')}</span>
      {#each [1, 2, 3] as c (c)}
        <button class="sw-btn sw-btn-ghost text-sw-xs" class:active={columns === c} onclick={() => (columns = c)}
          title={t('sessions.layoutCols', { n: c })}>{c}</button>
      {/each}
      {#if panes.length}
        <button class="sw-btn sw-btn-ghost text-sw-xs" onclick={closeAll} title={t('sessions.closeAllTip')}>
          {t('sessions.closeAll')}
        </button>
      {/if}
    </div>
  </header>

  <!-- Launcher: quick-launch a profile (Claude), or open the dialog for tool/folder/args -->
  <div class="launcher">
    <div class="cwd">
      <span class="text-sw-xs text-sw-text-muted">{t('sessions.cwdDefault')}</span>
      <div class="flex items-center gap-sw-3">
        <FolderField bind:value={cwd} placeholder={t('sessions.cwdShort')} />
        <label class="ask shrink-0" title={t('sessions.askFolderTip')}>
          <Toggle bind:checked={askFolder} />
          <span class="whitespace-nowrap text-sw-xs text-sw-text-secondary">{t('sessions.askFolder')}</span>
        </label>
      </div>
    </div>
    <div class="profiles">
      <button class="sw-btn sw-btn-primary text-sw-xs" onclick={() => openDlg()} title={t('sessions.newSessionTip')}>
        + {t('sessions.newSession')}
      </button>
      {#each profiles as p (p)}
        <button class="sw-btn sw-btn-ghost text-sw-xs" onclick={() => quick(p)} title={t('sessions.launchTip', { profile: p })}>
          ▶ {p}
        </button>
      {/each}
      {#if profiles.length > 1}
        <button class="sw-btn sw-btn-ghost text-sw-xs" onclick={launchAll} title={t('sessions.launchAllTip')}>
          {t('sessions.launchAll')}
        </button>
      {/if}
      <span class="text-sw-text-muted">·</span>
      <button class="sw-btn sw-btn-ghost text-sw-xs" onclick={() => quickTool('opencode')} title={t('sessions.launchToolTip', { tool: 'opencode' })}>▶ opencode</button>
      <button class="sw-btn sw-btn-ghost text-sw-xs" onclick={() => quickTool('shell')} title={t('sessions.launchToolTip', { tool: 'shell' })}>▶ shell</button>
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
  </div>

  <!-- Default launch args: applied to Claude quick-launches (profile buttons + "launch all") and
       pre-filled into the "+ new session" dialog. Chips toggle the common Claude flags. -->
  <div class="defargs">
    <span class="shrink-0 text-sw-xs text-sw-text-muted" title={t('sessions.defaultArgsHint')}>{t('sessions.defaultArgs')}</span>
    <input class="sw-input grow font-mono text-sw-xs" style="min-width:220px" bind:value={defaultArgs}
      placeholder={t('sessions.dlgArgsPlaceholder')} spellcheck="false" autocomplete="off" />
    {#each ARG_PRESETS.claude as flag (flag)}
      <button type="button" class="argchip" class:on={defaultArgs.includes(flag)}
        onclick={() => (defaultArgs = toggleFlag(defaultArgs, flag))}>{flag}</button>
    {/each}
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
            paneKey={pane.key}
            visible={visible && (maximized == null || maximized === pane.key)}
            maximized={maximized === pane.key}
            {broadcast}
            onInput={broadcastInput}
            {onIdChange}
            {onActivity}
            displayName={pane.name ?? ''}
            onRename={renamePane}
            onNewSession={() => openDlg()}
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
      <button class="sw-btn sw-btn-primary text-sw-xs mt-sw-2" onclick={() => openDlg()} title={t('sessions.newSessionTip')}>
        + {t('sessions.newSession')}
      </button>
    </div>
  {/if}

  <SessionLaunchDialog
    open={dlgOpen}
    {profiles}
    defaultProfile={dlgProfile}
    defaultCwd={cwd}
    {defaultArgs}
    onSubmit={onDlgSubmit}
    onCancel={() => (dlgOpen = false)}
  />
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
    flex-wrap: wrap;
    align-items: flex-end;
    gap: var(--sw-space-3);
    margin-bottom: var(--sw-space-4);
    padding-bottom: var(--sw-space-3);
    border-bottom: 1px solid var(--sw-border);
  }
  .workspaces {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--sw-space-2);
    margin-bottom: var(--sw-space-3);
  }
  .defargs {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--sw-space-2);
    margin-bottom: var(--sw-space-3);
  }
  .defargs .grow {
    flex: 1;
    min-width: 0;
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
  .ask {
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
  }
  .cwd {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 260px;
    flex: 1;
  }
  .profiles {
    display: flex;
    flex-wrap: wrap;
    gap: var(--sw-space-2);
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
