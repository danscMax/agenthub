<script lang="ts">
  import type {
    PluginInfo,
    SkillInfo,
    PluginAction,
    PluginUpdate,
    PluginContents
  } from '$lib/ipc';
  import { t, pSkill, pCommand, pAgent } from '$lib/i18n';
  import Toggle from './Toggle.svelte';
  import Spinner from './Spinner.svelte';

  let {
    plugins,
    skills,
    updates = [],
    contents = [],
    running,
    onAction,
    onRefresh,
    onOpenSkills
  }: {
    plugins: PluginInfo[] | null;
    skills: SkillInfo[] | null;
    updates?: PluginUpdate[];
    contents?: PluginContents[];
    running: string | null;
    onAction: (action: PluginAction, id: string) => void;
    onRefresh: () => void;
    onOpenSkills: () => void;
  } = $props();

  const busy = $derived(!!running);
  // Which plugin the user just acted on — drives a per-card spinner (the global `running` flag
  // has no id). Cleared when the run finishes.
  let actingId = $state<string | null>(null);
  $effect(() => {
    if (!running) actingId = null;
  });
  function act(action: PluginAction, id: string) {
    actingId = id;
    onAction(action, id);
  }
  const pluginList = $derived(plugins ?? []);
  const skillList = $derived(skills ?? []);
  const updateMap = $derived(new Map(updates.map((u) => [u.id, u.available])));
  const contentMap = $derived(new Map(contents.map((c) => [c.id, c])));

  // Filter: free-text by id + quick toggles (has-update / enabled-only).
  let query = $state('');
  let onlyUpdates = $state(false);
  let onlyEnabled = $state(false);
  // Sort cycles name → status (enabled first) → update (has-update first).
  let sortBy = $state<'name' | 'status' | 'update'>('name');
  const sortLabel = $derived(
    sortBy === 'status' ? t('plugins.sortStatus') : sortBy === 'update' ? t('plugins.sortUpdate') : t('plugins.sortName')
  );
  function cycleSort() {
    sortBy = sortBy === 'name' ? 'status' : sortBy === 'status' ? 'update' : 'name';
  }
  const filtered = $derived.by(() => {
    const q = query.trim().toLowerCase();
    const list = pluginList.filter(
      (p) =>
        (!q || p.id.toLowerCase().includes(q)) &&
        (!onlyUpdates || updateMap.has(p.id)) &&
        (!onlyEnabled || p.enabled)
    );
    return [...list].sort((a, b) => {
      if (sortBy === 'status') return Number(b.enabled) - Number(a.enabled) || a.id.localeCompare(b.id);
      if (sortBy === 'update') return Number(updateMap.has(b.id)) - Number(updateMap.has(a.id)) || a.id.localeCompare(b.id);
      return split(a.id).name.localeCompare(split(b.id).name);
    });
  });

  function split(id: string): { name: string; market: string } {
    const i = id.lastIndexOf('@');
    return i > 0 ? { name: id.slice(0, i), market: id.slice(i + 1) } : { name: id, market: '' };
  }
</script>

<div class="p-sw-6">
  <header class="mb-sw-4 flex items-start justify-between gap-sw-4">
    <div>
      <h1 class="text-lg font-semibold">{t('plugins.title')}</h1>
      <p class="text-sw-sm text-sw-text-secondary">{t('plugins.subtitle')}</p>
    </div>
    <button class="sw-btn sw-btn-ghost shrink-0" disabled={busy} onclick={onRefresh}
      title={t('plugins.refreshTip')}>
      {running === 'plugin-mgr' ? t('plugins.refreshing') : t('plugins.refreshBtn')}
    </button>
  </header>

  <!-- Plugins -->
  <h2 class="mb-sw-2 flex flex-wrap items-center gap-sw-2 text-sw-xs font-semibold uppercase tracking-wide text-sw-text-muted">
    {t('plugins.pluginsHeading', { count: pluginList.length })}
    {#if updates.length}<span class="badge badge-info normal-case" title={t('plugins.withUpdateBadgeTip')}>{t('plugins.withUpdateBadge', { count: updates.length })}</span>{/if}
  </h2>
  {#if pluginList.length}
    <div class="mb-sw-3 flex flex-wrap items-center gap-sw-2">
      <input class="sw-input text-sw-xs" style="min-width:220px;flex:1;max-width:360px" bind:value={query}
        placeholder={t('plugins.searchPlaceholder')} spellcheck="false" autocomplete="off" />
      {#if updates.length}
        <button class="sw-btn text-sw-xs {onlyUpdates ? 'sw-btn-primary' : 'sw-btn-ghost'}" onclick={() => (onlyUpdates = !onlyUpdates)}>{t('plugins.filterUpdates')}</button>
      {/if}
      <button class="sw-btn text-sw-xs {onlyEnabled ? 'sw-btn-primary' : 'sw-btn-ghost'}" onclick={() => (onlyEnabled = !onlyEnabled)}>{t('plugins.filterEnabled')}</button>
      <button class="sw-btn sw-btn-ghost text-sw-xs" onclick={cycleSort}>⇅ {sortLabel}</button>
    </div>
    <div class="card-grid">
      {#each filtered as p (p.id)}
        {@const s = split(p.id)}
        {@const c = contentMap.get(p.id)}
        <div class="sw-card flex flex-col gap-sw-3">
          <div class="flex items-start justify-between gap-sw-2">
            <div class="min-w-0">
              <h3 class="truncate font-medium" title={p.id}>{s.name}</h3>
              <p class="truncate text-sw-xs text-sw-text-muted">
                {s.market}{p.version && p.version !== 'unknown' ? ` · v${p.version}` : ''}
              </p>
            </div>
            <div class="flex shrink-0 flex-wrap items-center justify-end gap-sw-2">
              {#if updateMap.has(p.id)}<span class="badge badge-info" title={t('plugins.updateAvailableBadgeTip', { version: updateMap.get(p.id) ?? '' })}>{t('plugins.updateAvailableBadge')}</span>{/if}
              {#if p.scope === 'managed'}<span class="badge badge-muted" title={t('plugins.managedBadgeTip')}>{t('plugins.managedBadge')}</span>{/if}
            </div>
          </div>
          {#if c && (c.skills.length || c.commands.length || c.agents.length)}
            <details class="group rounded-sw-md border border-sw-border">
              <summary class="flex cursor-pointer list-none items-center gap-sw-2 px-sw-2 py-1 text-sw-xs text-sw-text-secondary"
                title={t('plugins.contentsToggleTip')}>
                <span class="transition-transform group-open:rotate-90">▸</span>
                <span>{t('plugins.contentsLabel')}</span>
                {#if c.skills.length}<span class="badge badge-muted" title={t('plugins.skillsBadgeTip')}>{t('plugins.skillsBadge', { count: c.skills.length, skills: pSkill(c.skills.length) })}</span>{/if}
                {#if c.commands.length}<span class="badge badge-muted" title={t('plugins.commandsBadgeTip')}>{t('plugins.commandsBadge', { count: c.commands.length, commands: pCommand(c.commands.length) })}</span>{/if}
                {#if c.agents.length}<span class="badge badge-muted" title={t('plugins.agentsBadgeTip')}>{t('plugins.agentsBadge', { count: c.agents.length, agents: pAgent(c.agents.length) })}</span>{/if}
              </summary>
              <div class="flex flex-col gap-sw-2 border-t border-sw-border px-sw-2 py-sw-2">
                {#each [{ label: t('plugins.catSkills'), items: c.skills }, { label: t('plugins.catCommands'), items: c.commands }, { label: t('plugins.catAgents'), items: c.agents }] as cat (cat.label)}
                  {#if cat.items.length}
                    <div>
                      <p class="mb-1 text-sw-xs font-semibold uppercase tracking-wide text-sw-text-muted">{cat.label}</p>
                      <div class="flex flex-wrap gap-1">
                        {#each cat.items as item (item)}
                          <span class="rounded bg-sw-bg-secondary px-1.5 py-0.5 font-mono text-[11px] text-sw-text-secondary">{item}</span>
                        {/each}
                      </div>
                    </div>
                  {/if}
                {/each}
              </div>
            </details>
          {/if}
          <div class="mt-auto flex flex-wrap items-center gap-sw-2 border-t border-sw-border pt-sw-2">
            {#if updateMap.has(p.id)}
              <button class="sw-btn sw-btn-primary text-sw-xs" disabled={busy} onclick={() => act('update', p.id)}
                title={t('plugins.updateBtnTip', { version: updateMap.get(p.id) ?? '' })}>{t('plugins.updateBtn')}</button>
            {:else}
              <span class="text-sw-xs text-sw-text-muted" title={t('plugins.upToDateTip')}>{t('plugins.upToDate')}</span>
            {/if}
            <span class="ml-auto flex items-center gap-sw-2 text-sw-xs text-sw-text-secondary">
              {#if actingId === p.id}<Spinner size={13} />{/if}
              {p.enabled ? t('plugins.enabledBadge') : t('plugins.disabledBadge')}
              <Toggle checked={p.enabled} disabled={busy}
                onCheckedChange={() => act(p.enabled ? 'disable' : 'enable', p.id)}
                title={p.enabled ? t('plugins.disableBtnTip') : t('plugins.enableBtnTip')} />
            </span>
          </div>
        </div>
      {/each}
    </div>
    {#if !filtered.length}
      <div class="sw-card text-sw-sm text-sw-text-muted">{t('plugins.noMatch')}</div>
    {/if}
  {:else}
    <div class="sw-card text-sw-sm text-sw-text-muted">{t('plugins.noPlugins')}</div>
  {/if}

  <!-- Skills -->
  <div class="mb-sw-2 mt-sw-6 flex items-center justify-between">
    <h2 class="text-sw-xs font-semibold uppercase tracking-wide text-sw-text-muted">
      {t('plugins.skillsHeading', { count: skillList.length })}
    </h2>
    {#if skillList.length}
      <button class="sw-btn sw-btn-ghost text-sw-xs" onclick={onOpenSkills}
        title={t('plugins.openSkillsTip')}>{t('plugins.openSkillsBtn')}</button>
    {/if}
  </div>
  <p class="mb-sw-2 text-sw-xs text-sw-text-muted">
    {t('plugins.skillsNote')}
  </p>
  {#if skillList.length}
    <div class="grid grid-cols-1 gap-sw-2 md:grid-cols-2">
      {#each skillList as sk (sk.dir)}
        <div class="sw-card py-sw-2">
          <div class="flex items-center gap-sw-2">
            <span class="truncate font-medium">{sk.name}</span>
            {#if sk.version}<span class="badge badge-muted shrink-0">v{sk.version}</span>{/if}
          </div>
          {#if sk.description}<p class="mt-1 text-sw-xs text-sw-text-secondary">{sk.description}</p>{/if}
        </div>
      {/each}
    </div>
  {:else}
    <div class="sw-card text-sw-sm text-sw-text-muted">{t('plugins.noSkills')}</div>
  {/if}
</div>
