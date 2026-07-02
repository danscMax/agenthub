<script lang="ts">
  // Shared section heading: title (uppercase tracking-wide muted small caps) + optional subtitle
  // + optional action slot on the right. Replaces one-off `<h2>`/`<p>` pairs in UpdatesTab,
  // ProvidersTab, EnvironmentsTab, AnalyticsTab so the section style is canonical.
  import type { Snippet } from 'svelte';
  let {
    title,
    subtitle,
    level = 'h2',
    action
  }: {
    title: string;
    subtitle?: string;
    level?: 'h2' | 'h3';
    action?: Snippet;
  } = $props();
</script>

<header class="section-header mb-sw-4 flex items-start justify-between gap-sw-3">
  <div class="min-w-0">
    <svelte:element this={level} class="section-title">{title}</svelte:element>
    {#if subtitle}
      <p class="section-subtitle mt-1">{subtitle}</p>
    {/if}
  </div>
  {#if action}
    <div class="shrink-0">{@render action()}</div>
  {/if}
</header>

<style>
  .section-header {
    gap: var(--sw-space-3);
  }
  /* .section-title itself is global (app.css) — V8: one canonical definition. */
  .section-subtitle {
    font-size: var(--sw-text-sm);
    color: var(--sw-text-secondary);
  }
</style>
