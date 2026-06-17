<script lang="ts">
  import { onMount } from 'svelte';
  import { getVersion } from '@tauri-apps/api/app';
  import {
    readConfig,
    writeConfig,
    appPaths,
    openPath,
    getAutostart,
    setAutostart,
    type HubConfig,
    type AppPaths
  } from '$lib/ipc';
  import type { Theme } from '$lib/theme';
  import { t, locale, getLocaleName, type Locale } from '$lib/i18n';
  import { copyText } from '$lib/clipboard';
  import Toggle from './Toggle.svelte';

  let {
    theme,
    onSetTheme,
    density = 'comfortable',
    fullWidth = false,
    onSetDensity,
    onSetFullWidth
  }: {
    theme: Theme;
    onSetTheme: (th: Theme) => void;
    density?: 'comfortable' | 'compact';
    fullWidth?: boolean;
    onSetDensity?: (d: 'comfortable' | 'compact') => void;
    onSetFullWidth?: (v: boolean) => void;
  } = $props();

  let cfg = $state<HubConfig>({});
  let scriptsRoot = $state('');
  let fetchTimeout = $state<number | ''>('');
  let ghTimeout = $state<number | ''>('');
  let autostart = $state(false);
  let startHidden = $state(false);
  let closeToTray = $state(true);
  let paths = $state<AppPaths | null>(null);
  let version = $state('');
  let savedMsg = $state('');
  let errMsg = $state('');

  onMount(async () => {
    try {
      cfg = await readConfig();
      scriptsRoot = cfg.scriptsRoot ?? '';
      fetchTimeout = cfg.fetchTimeoutSec ?? '';
      ghTimeout = cfg.ghTimeoutSec ?? '';
      startHidden = !!cfg.startHidden;
      closeToTray = cfg.closeToTray ?? true;
      autostart = await getAutostart();
      paths = await appPaths();
      version = await getVersion();
    } catch (e) {
      // Surface in-app — devtools console is invisible in the packaged build.
      errMsg = `${t('common.error')}: ${e}`;
    }
  });

  function flash(m: string) {
    savedMsg = m;
    setTimeout(() => (savedMsg = ''), 2000);
  }
  async function copyPath(p?: string | null) {
    if (!p) return;
    if (await copyText(p)) flash(t('common.copied'));
  }
  function resetView() {
    onSetDensity?.('comfortable');
    onSetFullWidth?.(false);
    flash(t('common.done'));
  }

  async function persist(patch: Partial<HubConfig>) {
    cfg = { ...cfg, ...patch };
    await writeConfig(cfg);
  }

  async function saveRoot() {
    await persist({ scriptsRoot: scriptsRoot.trim() || null });
    paths = await appPaths();
    flash(t('settings.savedPath'));
  }
  // Enforce the inputs' min=5 on save too (the browser only enforces it on validated submit).
  const clampTimeout = (v: number | '') => (v === '' ? null : Math.max(5, Number(v)));
  async function saveTimeouts() {
    await persist({
      fetchTimeoutSec: clampTimeout(fetchTimeout),
      ghTimeoutSec: clampTimeout(ghTimeout)
    });
    flash(t('settings.savedTimeouts'));
  }
  async function toggleAutostart(v: boolean) {
    autostart = v;
    await setAutostart(v);
    flash(v ? t('settings.autostartOn') : t('settings.autostartOff'));
  }
  async function toggleStartHidden(v: boolean) {
    startHidden = v;
    await persist({ startHidden: v });
    flash(t('settings.saved'));
  }
  async function toggleCloseToTray(v: boolean) {
    closeToTray = v;
    await persist({ closeToTray: v });
    flash(t('settings.saved'));
  }
</script>

<div class="p-sw-6">
  <header class="mb-sw-4 flex items-center justify-between">
    <h1 class="text-lg font-semibold">{t('settings.title')}</h1>
    {#if errMsg}<span class="badge badge-err">{errMsg}</span>{:else if savedMsg}<span class="badge badge-ok">{savedMsg}</span>{/if}
  </header>

  <div class="flex max-w-2xl flex-col gap-sw-4">
    <!-- Theme -->
    <div class="sw-card flex items-center justify-between">
      <div>
        <div class="font-medium">{t('settings.theme')}</div>
        <div class="text-sw-sm text-sw-text-secondary">{t('settings.themeDesc')}</div>
      </div>
      <div class="flex gap-sw-2">
        <button class="sw-btn {theme === 'dark' ? 'sw-btn-primary' : 'sw-btn-ghost'}"
          onclick={() => onSetTheme('dark')} title={t('settings.themeDarkTip')}>{t('settings.themeDark')}</button>
        <button class="sw-btn {theme === 'light' ? 'sw-btn-primary' : 'sw-btn-ghost'}"
          onclick={() => onSetTheme('light')} title={t('settings.themeLightTip')}>{t('settings.themeLight')}</button>
        <button class="sw-btn {theme === 'system' ? 'sw-btn-primary' : 'sw-btn-ghost'}"
          onclick={() => onSetTheme('system')} title={t('settings.themeSystemTip')}>{t('settings.themeSystem')}</button>
      </div>
    </div>

    <!-- View: density + content width -->
    <div class="sw-card flex flex-col gap-sw-3">
      <div class="flex items-center justify-between gap-sw-2">
        <div class="font-medium">{t('settings.view')}</div>
        <button class="sw-btn sw-btn-ghost text-sw-xs" onclick={resetView} title={t('settings.resetViewTip')}>{t('settings.resetView')}</button>
      </div>
      <div class="flex items-center justify-between gap-sw-4">
        <div class="text-sw-sm text-sw-text-secondary">{t('settings.density')}</div>
        <div class="flex gap-sw-2">
          <button class="sw-btn {density === 'comfortable' ? 'sw-btn-primary' : 'sw-btn-ghost'}"
            onclick={() => onSetDensity?.('comfortable')}>{t('settings.densityComfortable')}</button>
          <button class="sw-btn {density === 'compact' ? 'sw-btn-primary' : 'sw-btn-ghost'}"
            onclick={() => onSetDensity?.('compact')}>{t('settings.densityCompact')}</button>
        </div>
      </div>
      <label class="flex items-center justify-between gap-sw-4">
        <span class="text-sw-sm">{t('settings.fullWidth')}
          <span class="block text-sw-xs text-sw-text-muted">{t('settings.fullWidthDesc')}</span>
        </span>
        <Toggle checked={fullWidth} onCheckedChange={(v) => onSetFullWidth?.(v)} title={t('settings.fullWidth')} />
      </label>
    </div>

    <!-- Language -->
    <div class="sw-card flex items-center justify-between">
      <div>
        <div class="font-medium">{t('settings.language')}</div>
        <div class="text-sw-sm text-sw-text-secondary">{t('settings.languageDesc')}</div>
      </div>
      <div class="flex gap-sw-2">
        {#each locale.supported as loc (loc)}
          <button
            class="sw-btn {locale.current === loc ? 'sw-btn-primary' : 'sw-btn-ghost'}"
            onclick={() => locale.set(loc as Locale)}
            title={t('settings.languageTip')}
          >
            {getLocaleName(loc as Locale)}
          </button>
        {/each}
      </div>
    </div>

    <!-- Scripts root -->
    <div class="sw-card flex flex-col gap-sw-2">
      <div class="font-medium">{t('settings.scriptsRoot')}</div>
      <div class="text-sw-sm text-sw-text-secondary">
        {t('settings.scriptsRootDesc')}
      </div>
      <div class="flex gap-sw-2">
        <input
          class="sw-input flex-1"
          placeholder="E:\Scripts"
          bind:value={scriptsRoot}
          title={t('settings.scriptsRootInputTip')}
        />
        <button class="sw-btn sw-btn-primary" onclick={saveRoot} title={t('settings.savePathTip')}>{t('common.save')}</button>
      </div>
      {#if paths}<div class="text-sw-xs text-sw-text-muted">{t('settings.currentlyUsed', { path: paths.scriptsRoot })}</div>{/if}
    </div>

    <!-- Launch -->
    <div class="sw-card flex flex-col gap-sw-3">
      <div class="font-medium">{t('settings.launch')}</div>
      <label class="flex items-center justify-between gap-sw-4">
        <span class="text-sw-sm">{t('settings.startWithWindows')}
          <span class="block text-sw-xs text-sw-text-muted">{t('settings.startWithWindowsDesc')}</span>
        </span>
        <Toggle checked={autostart} onCheckedChange={toggleAutostart} title={t('settings.startWithWindowsTip')} />
      </label>
      <label class="flex items-center justify-between gap-sw-4">
        <span class="text-sw-sm">{t('settings.startHidden')}
          <span class="block text-sw-xs text-sw-text-muted">{t('settings.startHiddenDesc')}</span>
        </span>
        <Toggle checked={startHidden} onCheckedChange={toggleStartHidden} title={t('settings.startHiddenTip')} />
      </label>
      <label class="flex items-center justify-between gap-sw-4">
        <span class="text-sw-sm">{t('settings.closeToTray')}
          <span class="block text-sw-xs text-sw-text-muted">{t('settings.closeToTrayDesc')}</span>
        </span>
        <Toggle checked={closeToTray} onCheckedChange={toggleCloseToTray} title={t('settings.closeToTrayTip')} />
      </label>
    </div>

    <!-- Timeouts -->
    <div class="sw-card flex flex-col gap-sw-2">
      <div class="font-medium">{t('settings.timeouts')}</div>
      <div class="text-sw-sm text-sw-text-secondary">{t('settings.timeoutsDesc')}</div>
      <div class="flex flex-wrap items-end gap-sw-4">
        <label class="flex flex-col gap-1 text-sw-xs text-sw-text-muted">
          {t('settings.fetchTimeout')}
          <input class="sw-input w-28" type="number" min="5" bind:value={fetchTimeout} placeholder="120" title={t('settings.fetchTimeoutTip')} />
        </label>
        <label class="flex flex-col gap-1 text-sw-xs text-sw-text-muted">
          {t('settings.ghTimeout')}
          <input class="sw-input w-28" type="number" min="5" bind:value={ghTimeout} placeholder="60" title={t('settings.ghTimeoutTip')} />
        </label>
        <button class="sw-btn sw-btn-primary" onclick={saveTimeouts} title={t('settings.saveTimeoutsTip')}>{t('common.save')}</button>
      </div>
    </div>

    <!-- About -->
    <div class="sw-card flex flex-col gap-sw-2">
      <div class="font-medium">{t('settings.about')}</div>
      <dl class="grid grid-cols-[auto_1fr] gap-x-sw-4 gap-y-1 text-sw-sm">
        <dt class="text-sw-text-muted">{t('settings.version')}</dt><dd class="text-sw-text">{version || t('common.dash')}</dd>
        <dt class="text-sw-text-muted">{t('settings.scripts')}</dt>
        <dd class="min-w-0"><button class="copyable" onclick={() => copyPath(paths?.scriptsRoot)} title={t('common.copyPath')}>{paths?.scriptsRoot ?? t('common.dash')}</button></dd>
        <dt class="text-sw-text-muted">{t('settings.config')}</dt>
        <dd class="min-w-0"><button class="copyable" onclick={() => copyPath(paths?.configPath)} title={t('common.copyPath')}>{paths?.configPath ?? t('common.dash')}</button></dd>
        <dt class="text-sw-text-muted">{t('settings.app')}</dt>
        <dd class="min-w-0"><button class="copyable" onclick={() => copyPath(paths?.exe)} title={t('common.copyPath')}>{paths?.exe ?? t('common.dash')}</button></dd>
      </dl>
      <div class="flex gap-sw-2 pt-sw-1">
        {#if paths?.scriptsRoot}
          <button class="sw-btn sw-btn-ghost text-sw-xs" onclick={() => openPath(paths!.scriptsRoot)}
            title={t('settings.openScriptsFolderTip')}>{t('settings.openScriptsFolder')}</button>
        {/if}
      </div>
    </div>
  </div>
</div>

<style>
  /* A path/value that copies to the clipboard on click — looks like text, hints on hover. */
  .copyable {
    display: block;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    text-align: left;
    background: none;
    border: none;
    padding: 0;
    margin: 0;
    font: inherit;
    color: var(--sw-text);
    cursor: pointer;
  }
  .copyable:hover {
    color: var(--sw-accent-text);
    text-decoration: underline;
  }
</style>
