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

</script>

<div class="p-sw-6">
  <header class="mb-sw-4">
    <h1 class="text-lg font-semibold">{t('updates.title')}</h1>
    <p class="text-sw-sm text-sw-text-secondary">
      {t('updates.subtitle')}
    </p>
  </header>

  <!-- Flat auto-fill grid: every card fills the row evenly (each card already shows its group),
       so a big group no longer makes one tall column with empty space beside it. -->
  <div class="group-grid">
    {#each components as c (c.id)}
      <ComponentCard
        comp={c}
        status={statuses[c.id]}
        busy={running === c.id}
        anyRunning={!!running}
        onCheck={() => onCheck(c.id)}
        onApply={() => onApply(c)}
        onOpenForks={onOpenTab ? () => onOpenTab('forks') : undefined}
      />
    {/each}
  </div>
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
