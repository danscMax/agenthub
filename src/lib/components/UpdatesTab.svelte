<script lang="ts">
  import type { Component } from '$lib/ipc';
  import ComponentCard from './ComponentCard.svelte';
  import { t } from '$lib/i18n';

  let {
    components,
    statuses,
    running,
    onCheck,
    onApply,
    onOpenTab
  }: {
    components: Component[];
    statuses: Record<string, any>;
    running: string | null;
    onCheck: (id: string) => void;
    onApply: (comp: Component) => void;
    onOpenTab?: (id: string) => void;
  } = $props();

  // #110: split into "has update" vs "up to date" (mirrors ComponentCard.updateInfo).
  function hasUpdate(c: Component): boolean {
    const s = statuses[c.id];
    if (!s || c.lastJson === null) return false;
    const changed =
      typeof s?.counts?.changed === 'number'
        ? s.counts.changed
        : Array.isArray(s?.changed)
          ? s.changed.length
          : (s?.plugins_changed ?? 0);
    return s.status === 'changes' || changed > 0;
  }
  const withUpdates = $derived(components.filter(hasUpdate));
  const upToDate = $derived(components.filter((c) => !hasUpdate(c)));
</script>

<div class="p-sw-6">
  <header class="mb-sw-4">
    <h1 class="text-lg font-semibold">{t('updates.title')}</h1>
    <p class="text-sw-sm text-sw-text-secondary">
      {t('updates.subtitle')}
    </p>
  </header>

  {#snippet card(c: Component)}
    <ComponentCard
      comp={c}
      status={statuses[c.id]}
      busy={running === c.id}
      anyRunning={!!running}
      onCheck={() => onCheck(c.id)}
      onApply={() => onApply(c)}
      onOpenForks={onOpenTab ? () => onOpenTab('forks') : undefined}
    />
  {/snippet}

  <!-- Group by update status (#110): components with an available update float to the top, the
       rest collapse under an "up to date" heading. When nothing has an update, one flat grid. -->
  {#if withUpdates.length}
    <h2 class="mb-sw-2 text-sw-xs font-semibold uppercase tracking-wide text-sw-text-muted">
      {t('updates.groupHasUpdate', { count: withUpdates.length })}
    </h2>
    <div class="group-grid mb-sw-6">
      {#each withUpdates as c (c.id)}{@render card(c)}{/each}
    </div>
    <h2 class="mb-sw-2 text-sw-xs font-semibold uppercase tracking-wide text-sw-text-muted">
      {t('updates.groupUpToDate', { count: upToDate.length })}
    </h2>
    <div class="group-grid">
      {#each upToDate as c (c.id)}{@render card(c)}{/each}
    </div>
  {:else}
    <div class="group-grid">
      {#each components as c (c.id)}{@render card(c)}{/each}
    </div>
  {/if}
</div>

<style>
  .group-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
    gap: var(--sw-space-4);
    /* stretch → cards in the same row share a height (footers align), so the grid looks even
       instead of ragged when one card (e.g. forks) has extra content. */
    align-items: stretch;
  }
</style>
