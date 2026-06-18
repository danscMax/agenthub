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
    onOpenSkills,
    onOpenSkill,
    onDeleteSkill
  }: {
    plugins: PluginInfo[] | null;
    skills: SkillInfo[] | null;
    updates?: PluginUpdate[];
    contents?: PluginContents[];
    running: string | null;
    onAction: (action: PluginAction, id: string) => void;
    onRefresh: () => void;
    onOpenSkills: () => void;
    onOpenSkill: (dir: string) => void;
    onDeleteSkill: (dir: string, name: string) => void;
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
  // Which plugin row has its bundled-contents detail expanded (one at a time).
  let expandedId = $state<string | null>(null);
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

  // #90: the same free-text query also filters the skills section.
  const filteredSkills = $derived.by(() => {
    const q = query.trim().toLowerCase();
    return skillList.filter(
      (s) => !q || s.name.toLowerCase().includes(q) || (s.description ?? '').toLowerCase().includes(q)
    );
  });
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
    <div class="overflow-x-auto rounded-sw-md border border-sw-border">
      <table class="w-full text-sw-sm">
        <thead>
          <tr class="border-b border-sw-border text-left text-sw-xs uppercase tracking-wide text-sw-text-muted">
            <th class="px-sw-2 py-sw-1 font-medium">{t('plugins.colName')}</th>
            <th class="px-sw-2 py-sw-1 font-medium">{t('plugins.colMarket')}</th>
            <th class="px-sw-2 py-sw-1 font-medium">{t('plugins.colVersion')}</th>
            <th class="px-sw-2 py-sw-1 font-medium">{t('plugins.colContents')}</th>
            <th class="px-sw-2 py-sw-1 font-medium">{t('plugins.colStatus')}</th>
            <th class="px-sw-2 py-sw-1 text-right font-medium">{t('plugins.colActions')}</th>
          </tr>
        </thead>
        <tbody>
          {#each filtered as p (p.id)}
            {@const s = split(p.id)}
            {@const c = contentMap.get(p.id)}
            <tr class="border-b border-sw-border/40 hover:bg-sw-bg-secondary/40">
              <td class="px-sw-2 py-sw-1">
                <span class="font-medium" title={p.id}>{s.name}</span>
                {#if p.scope === 'managed'}<span class="badge badge-muted ml-sw-2" title={t('plugins.managedBadgeTip')}>{t('plugins.managedBadge')}</span>{/if}
              </td>
              <td class="px-sw-2 py-sw-1 text-sw-xs text-sw-text-muted">{s.market || '—'}</td>
              <td class="px-sw-2 py-sw-1 text-sw-xs whitespace-nowrap">
                {p.version && p.version !== 'unknown' ? `v${p.version}` : '—'}
                {#if updateMap.has(p.id)}<span class="badge badge-info ml-sw-1" title={t('plugins.updateAvailableBadgeTip', { version: updateMap.get(p.id) ?? '' })}>↑ v{updateMap.get(p.id)}</span>{/if}
              </td>
              <td class="px-sw-2 py-sw-1 text-sw-xs">
                {#if c && (c.skills.length || c.commands.length || c.agents.length)}
                  <button class="text-sw-text-secondary hover:text-sw-text" onclick={() => (expandedId = expandedId === p.id ? null : p.id)} title={t('plugins.contentsToggleTip')}>
                    {#if c.skills.length}{c.skills.length} {pSkill(c.skills.length)}{/if}{#if c.commands.length} · {c.commands.length} {pCommand(c.commands.length)}{/if}{#if c.agents.length} · {c.agents.length} {pAgent(c.agents.length)}{/if} {expandedId === p.id ? '▾' : '▸'}
                  </button>
                {:else}<span class="text-sw-text-muted">—</span>{/if}
              </td>
              <td class="px-sw-2 py-sw-1">
                <span class="flex items-center gap-sw-2">
                  {#if actingId === p.id}<Spinner size={13} />{/if}
                  <Toggle checked={p.enabled} disabled={busy} onCheckedChange={() => act(p.enabled ? 'disable' : 'enable', p.id)} title={p.enabled ? t('plugins.disableBtnTip') : t('plugins.enableBtnTip')} />
                </span>
              </td>
              <td class="px-sw-2 py-sw-1">
                <span class="flex items-center justify-end gap-sw-2">
                  {#if updateMap.has(p.id)}
                    <button class="sw-btn sw-btn-primary text-sw-xs" disabled={busy} onclick={() => act('update', p.id)} title={t('plugins.updateBtnTip', { version: updateMap.get(p.id) ?? '' })}>{t('plugins.updateBtn')}</button>
                  {/if}
                  <button class="sw-btn sw-btn-danger text-sw-xs" disabled={busy} onclick={() => act('remove', p.id)} title={t('plugins.removeBtnTip')}>{t('plugins.removeBtn')}</button>
                </span>
              </td>
            </tr>
            {#if expandedId === p.id && c && (c.skills.length || c.commands.length || c.agents.length)}
              <tr class="border-b border-sw-border/40 bg-sw-bg-secondary/30">
                <td colspan="6" class="px-sw-3 py-sw-2">
                  <div class="flex flex-col gap-sw-2">
                    {#each [{ label: t('plugins.catSkills'), items: c.skills }, { label: t('plugins.catCommands'), items: c.commands }, { label: t('plugins.catAgents'), items: c.agents }] as cat (cat.label)}
                      {#if cat.items.length}
                        <div>
                          <p class="mb-1 text-sw-xs font-semibold uppercase tracking-wide text-sw-text-muted">{cat.label}</p>
                          <div class="flex flex-wrap gap-1">
                            {#each cat.items as item (item)}<span class="rounded bg-sw-bg-secondary px-1.5 py-0.5 font-mono text-[11px] text-sw-text-secondary">{item}</span>{/each}
                          </div>
                        </div>
                      {/if}
                    {/each}
                  </div>
                </td>
              </tr>
            {/if}
          {/each}
        </tbody>
      </table>
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
    {#if filteredSkills.length}
      <div class="overflow-x-auto rounded-sw-md border border-sw-border">
        <table class="w-full text-sw-sm">
          <thead>
            <tr class="border-b border-sw-border text-left text-sw-xs uppercase tracking-wide text-sw-text-muted">
              <th class="px-sw-2 py-sw-1 font-medium">{t('plugins.colName')}</th>
              <th class="px-sw-2 py-sw-1 font-medium">{t('plugins.colVersion')}</th>
              <th class="px-sw-2 py-sw-1 font-medium">{t('plugins.skillColDesc')}</th>
              <th class="px-sw-2 py-sw-1 text-right font-medium">{t('plugins.colActions')}</th>
            </tr>
          </thead>
          <tbody>
            {#each filteredSkills as sk (sk.dir)}
              <tr class="border-b border-sw-border/40 hover:bg-sw-bg-secondary/40">
                <td class="px-sw-2 py-sw-1 font-medium">{sk.name}</td>
                <td class="px-sw-2 py-sw-1 text-sw-xs text-sw-text-muted whitespace-nowrap">{sk.version ? `v${sk.version}` : '—'}</td>
                <td class="px-sw-2 py-sw-1 text-sw-xs text-sw-text-secondary"><span class="line-clamp-1" title={sk.description ?? ''}>{sk.description ?? ''}</span></td>
                <td class="px-sw-2 py-sw-1">
                  <span class="flex items-center justify-end gap-sw-2">
                    <button class="sw-btn sw-btn-ghost text-sw-xs" onclick={() => onOpenSkill(sk.dir)} title={t('plugins.skillOpenTip')}>{t('plugins.skillOpen')}</button>
                    <button class="sw-btn sw-btn-danger text-sw-xs" onclick={() => onDeleteSkill(sk.dir, sk.name)} title={t('plugins.skillDeleteTip')}>{t('plugins.skillDelete')}</button>
                  </span>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {:else}
      <div class="sw-card text-sw-sm text-sw-text-muted">{t('plugins.noMatch')}</div>
    {/if}
  {:else}
    <div class="sw-card text-sw-sm text-sw-text-muted">{t('plugins.noSkills')}</div>
  {/if}
</div>
