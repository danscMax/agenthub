<script lang="ts">
  import { toastStore, markNotifRead, clearHistory, dismissFromHistory } from '$lib/toast.svelte';
  import { t } from '$lib/i18n';

  let { open = false, onClose }: { open: boolean; onClose: () => void } = $props();

  let history = $derived(toastStore.history);

  function onBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) onClose();
  }

  $effect(() => {
    if (open) markNotifRead();
  });

  const kindIcon: Record<string, string> = {
    success: '✓',
    warn: '⚠',
    error: '✗',
    info: 'ℹ'
  };

  function fmtRel(ts: number): string {
    const diff = Date.now() - ts;
    if (diff < 60000) return t('common.justNow');
    if (diff < 3600000) return t('common.minutesAgo', { n: Math.floor(diff / 60000) });
    if (diff < 86400000) return t('common.hoursAgo', { n: Math.floor(diff / 3600000) });
    return t('common.daysAgo', { n: Math.floor(diff / 86400000) });
  }
</script>

{#if open}
  <div class="backdrop" onclick={onBackdropClick} role="presentation">
    <div class="panel" role="dialog" aria-label={t('page.notifTitle')}>
      <header class="head">
        <h2 class="title">{t('page.notifTitle')}</h2>
        <div class="acts">
          {#if history.items.length}
            <button class="clear-btn" onclick={clearHistory}>{t('page.notifDismissAll')}</button>
          {/if}
          <button class="close-btn" onclick={onClose} aria-label={t('common.close')}>×</button>
        </div>
      </header>
      {#if history.items.length === 0}
        <div class="empty">{t('page.notifEmpty')}</div>
      {:else}
        <div class="list">
          {#each history.items as item, i (item.timestamp)}
            <div class="entry {item.kind}">
              <span class="icon" class:icon-success={item.kind === 'success'} class:icon-warn={item.kind === 'warn'} class:icon-error={item.kind === 'error'} class:icon-info={item.kind === 'info'}>{kindIcon[item.kind]}</span>
              <div class="body">
                <div class="entry-title">{item.title}</div>
                {#if item.detail}<div class="entry-detail">{item.detail}</div>{/if}
                <div class="entry-time" title={new Date(item.timestamp).toLocaleString()}>{fmtRel(item.timestamp)}</div>
              </div>
              <button class="entry-x" onclick={() => dismissFromHistory(item.timestamp)} aria-label={t('common.close')}>×</button>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    z-index: 55;
    display: flex;
    justify-content: flex-start;
    align-items: flex-start;
    padding: 80px 0 0 80px;
    pointer-events: auto;
  }
  .panel {
    width: 380px;
    max-height: min(480px, 80vh);
    background: var(--sw-bg-secondary);
    border: 1px solid var(--sw-border);
    border-radius: var(--sw-radius-md);
    box-shadow: 0 16px 40px rgba(0, 0, 0, 0.5);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 14px;
    border-bottom: 1px solid var(--sw-border);
  }
  .title {
    font-size: var(--sw-text-sm);
    font-weight: 600;
    color: var(--sw-text-primary);
    margin: 0;
  }
  .acts {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .clear-btn {
    font-size: var(--sw-text-xs);
    color: var(--sw-text-secondary);
    background: transparent;
    border: 1px solid var(--sw-border);
    border-radius: var(--sw-radius-sm);
    padding: 3px 8px;
    cursor: pointer;
  }
  .clear-btn:hover {
    color: var(--sw-text-primary);
    border-color: var(--sw-border-focus, #64748b);
  }
  .close-btn {
    border: none;
    background: transparent;
    color: var(--sw-text-muted);
    font-size: 20px;
    cursor: pointer;
    padding: 0 2px;
    line-height: 1;
  }
  .close-btn:hover { color: var(--sw-text-primary); }
  .empty {
    padding: 32px 14px;
    text-align: center;
    font-size: var(--sw-text-sm);
    color: var(--sw-text-muted);
  }
  .list {
    overflow-y: auto;
    flex: 1;
  }
  .entry {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 10px 14px;
    border-bottom: 1px solid var(--sw-border);
  }
  .entry:last-child { border-bottom: none; }
  .icon {
    width: 20px;
    height: 20px;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    font-size: 11px;
    font-weight: 700;
  }
  .icon-success { background: color-mix(in srgb, var(--sw-success) 20%, transparent); color: var(--sw-success); }
  .icon-warn { background: color-mix(in srgb, var(--sw-warn) 20%, transparent); color: var(--sw-warn); }
  .icon-error { background: color-mix(in srgb, var(--sw-danger) 20%, transparent); color: var(--sw-danger); }
  .icon-info { background: color-mix(in srgb, #38bdf8 20%, transparent); color: #38bdf8; }
  .body { min-width: 0; flex: 1; }
  .entry-title {
    font-size: var(--sw-text-sm);
    font-weight: 500;
    color: var(--sw-text-primary);
    word-break: break-word;
  }
  .entry-detail {
    font-size: var(--sw-text-xs);
    color: var(--sw-text-secondary);
    margin-top: 2px;
    word-break: break-word;
  }
  .entry-time {
    font-size: 11px;
    color: var(--sw-text-muted);
    margin-top: 4px;
  }
  .entry-x {
    border: none;
    background: transparent;
    color: var(--sw-text-muted);
    cursor: pointer;
    font-size: 16px;
    padding: 0;
    line-height: 1;
    opacity: 0;
    flex-shrink: 0;
  }
  .entry:hover .entry-x { opacity: 1; }
  .entry-x:hover { color: var(--sw-text-primary); }
</style>