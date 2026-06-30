<script lang="ts">
  import type { Component } from 'svelte';
  let {
    icon = null,
    title = '',
    description = '',
    action,
    actionLabel = ''
  }: {
    icon?: Component | null;
    title?: string;
    description?: string;
    action?: () => void;
    actionLabel?: string;
  } = $props();
</script>

<div class="empty-state">
  {#if icon}
    {@const Icon = icon}
    <div class="empty-icon"><Icon size={32} strokeWidth={1.5} /></div>
  {/if}
  {#if title}
    <div class="empty-title">{title}</div>
  {/if}
  {#if description}
    <div class="empty-desc">{description}</div>
  {/if}
  {#if action}
    <button class="sw-btn sw-btn-primary text-sw-xs mt-sw-2" onclick={action}>{actionLabel}</button>
  {/if}
</div>

<style>
  .empty-state {
    display: grid;
    place-items: center;
    padding: 1.5rem 0;
    text-align: center;
    color: var(--sw-text-muted);
  }
  .empty-icon {
    line-height: 1;
    margin-bottom: 0.5rem;
    opacity: 0.5;
    color: currentColor;
  }
  .empty-icon :global(svg) {
    display: block;
  }
  .empty-title {
    font-weight: 500;
    color: var(--sw-text);
  }
  .empty-desc {
    font-size: var(--sw-text-sm);
    color: var(--sw-text-secondary);
  }
</style>
