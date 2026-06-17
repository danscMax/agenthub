<script lang="ts">
  import { onMount } from 'svelte';
  import TerminalPane from './TerminalPane.svelte';
  import SessionLaunchDialog from './SessionLaunchDialog.svelte';
  import { t } from '$lib/i18n';
  import type { SessionTool } from '$lib/ipc';

  let { profiles = [], visible = true }: { profiles?: string[]; visible?: boolean } = $props();

  type Pane = { key: string; profile: string; tool: SessionTool; cwd: string; args: string };
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
  let lastFolders = $state<Record<string, string>>({});
  onMount(() => {
    try {
      lastFolders = JSON.parse(localStorage.getItem(FKEY) ?? '{}');
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

  function addPane(v: { tool: SessionTool; profile: string; cwd: string; args: string }) {
    const key = `${v.tool}:${v.profile || 'sh'}#${seq++}`;
    panes = [...panes, { key, profile: v.profile, tool: v.tool, cwd: v.cwd, args: v.args }];
    if (v.tool === 'claude') rememberFolder(v.profile, v.cwd);
  }
  // Quick launch: Claude under a profile, in its remembered folder (or the default), no extra args.
  function quick(profile: string) {
    addPane({ tool: 'claude', profile, cwd: lastFolders[profile] ?? cwd, args: '' });
  }
  function launchAll() {
    for (const p of profiles) quick(p);
  }
  function closePane(key: string) {
    panes = panes.filter((p) => p.key !== key);
    if (maximized === key) maximized = null;
  }
  function closeAll() {
    panes = [];
    maximized = null;
  }
  function toggleMax(key: string) {
    maximized = maximized === key ? null : key;
  }
  const shown = $derived(maximized ? panes.filter((p) => p.key === maximized) : panes);

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
</script>

<div class="wrap">
  <header class="mb-sw-4 flex items-start justify-between gap-sw-4">
    <div>
      <h1 class="text-lg font-semibold">{t('sessions.title')}</h1>
      <p class="text-sw-sm text-sw-text-secondary">{t('sessions.subtitle')}</p>
    </div>
    <div class="flex shrink-0 items-center gap-sw-2">
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
    <label class="cwd">
      <span class="text-sw-xs text-sw-text-muted">{t('sessions.cwd')}</span>
      <input class="sw-input text-sw-xs" bind:value={cwd} placeholder={t('sessions.cwdPlaceholder')} spellcheck="false" />
    </label>
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
    </div>
  </div>

  {#if panes.length}
    <div class="grid" style="grid-template-columns: repeat({maximized ? 1 : columns}, minmax(0, 1fr));">
      {#each shown as pane (pane.key)}
        <TerminalPane
          profile={pane.profile}
          tool={pane.tool}
          args={pane.args}
          cwd={pane.cwd || undefined}
          paneKey={pane.key}
          {visible}
          maximized={maximized === pane.key}
          onClose={() => closePane(pane.key)}
          onToggleMax={() => toggleMax(pane.key)}
          onDuplicate={() => duplicate(pane.key)}
          {onDragStart}
          {onDragEnter}
          {onDrop}
        />
      {/each}
    </div>
  {:else}
    <div class="empty">
      <div class="empty-icon">▦</div>
      <div class="font-medium text-sw-text">{t('sessions.emptyTitle')}</div>
      <div class="text-sw-sm text-sw-text-muted">{t('sessions.emptyHint')}</div>
    </div>
  {/if}

  <SessionLaunchDialog
    open={dlgOpen}
    {profiles}
    defaultProfile={dlgProfile}
    defaultCwd={cwd}
    onSubmit={onDlgSubmit}
    onCancel={() => (dlgOpen = false)}
  />
</div>

<style>
  .wrap {
    padding: var(--sw-space-6);
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
  .grid {
    display: grid;
    gap: var(--sw-space-3);
    flex: 1;
    min-height: 0;
    /* Rows share the available height (so panes fill the page); they only scroll once
       there are too many to fit at a sensible minimum height. */
    grid-auto-rows: minmax(220px, 1fr);
    overflow-y: auto;
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
