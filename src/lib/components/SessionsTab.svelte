<script lang="ts">
  import TerminalPane from './TerminalPane.svelte';
  import { t } from '$lib/i18n';

  let { profiles = [], visible = true }: { profiles?: string[]; visible?: boolean } = $props();

  // Each pane is an independent terminal; the key (not the profile) identifies it, so the same
  // profile can run in several panes at once.
  let panes = $state<{ key: string; profile: string }[]>([]);
  let seq = 0;
  let columns = $state(2);
  let cwd = $state('');
  let maximized = $state<string | null>(null); // key of the pane shown full-screen, or null

  function launch(profile: string) {
    panes = [...panes, { key: `${profile}#${seq++}`, profile }];
  }
  function launchAll() {
    for (const p of profiles) launch(p);
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
  // When maximized, render only that pane; otherwise the whole grid.
  const shown = $derived(maximized ? panes.filter((p) => p.key === maximized) : panes);
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

  <!-- Launcher: pick a profile to open a new terminal (claude runs under it) -->
  <div class="launcher">
    <label class="cwd">
      <span class="text-sw-xs text-sw-text-muted">{t('sessions.cwd')}</span>
      <input class="sw-input text-sw-xs" bind:value={cwd} placeholder={t('sessions.cwdPlaceholder')} spellcheck="false" />
    </label>
    <div class="profiles">
      {#each profiles as p (p)}
        <button class="sw-btn sw-btn-ghost text-sw-xs" onclick={() => launch(p)} title={t('sessions.launchTip', { profile: p })}>
          ▶ {p}
        </button>
      {/each}
      {#if profiles.length > 1}
        <button class="sw-btn sw-btn-primary text-sw-xs" onclick={launchAll} title={t('sessions.launchAllTip')}>
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
          cwd={cwd || undefined}
          {visible}
          maximized={maximized === pane.key}
          onClose={() => closePane(pane.key)}
          onToggleMax={() => toggleMax(pane.key)}
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
