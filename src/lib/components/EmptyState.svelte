<script lang="ts">
  let {
    icon = '',
    title = '',
    description = '',
    action,
    actionLabel = ''
  }: {
    icon?: string;
    title?: string;
    description?: string;
    action?: () => void;
    actionLabel?: string;
  } = $props();
</script>

<div class="empty-state">
  {#if icon}
    <div class="empty-icon">{@html icon}</div>
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
    font-size: 1.5rem;
    line-height: 1;
    margin-bottom: 0.5rem;
    opacity: 0.5;
  }
  .empty-icon :global(svg) {
    display: block;
    width: 2rem;
    height: 2rem;
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
