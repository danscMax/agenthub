<script lang="ts">
  import { t } from '$lib/i18n';

  let {
    open,
    title,
    message,
    confirmLabel = t('common.confirm'),
    details = [],
    requireText = null,
    danger = false,
    onConfirm,
    onCancel
  }: {
    open: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    /** Concrete items the action will affect (branches/files) — shown so the user sees the scope. */
    details?: string[];
    /** When set, the confirm button is enabled only after the user types this exact string. */
    requireText?: string | null;
    /** Render the confirm button in the destructive (red) style. */
    danger?: boolean;
    onConfirm: () => void;
    onCancel: () => void;
  } = $props();

  let typed = $state('');
  // Reset the type-to-confirm field each time the dialog opens.
  $effect(() => {
    if (open) typed = '';
  });
  const blocked = $derived(!!requireText && typed.trim() !== requireText);
  function confirm() {
    if (!blocked) onConfirm();
  }
</script>

<svelte:window onkeydown={(e) => open && e.key === 'Escape' && onCancel()} />

{#if open}
  <div class="overlay">
    <button type="button" class="backdrop" aria-label={t('common.close')} onclick={onCancel}></button>
    <div class="dialog" role="dialog" aria-modal="true" tabindex="-1">
      <h3>{title}</h3>
      <p>{message}</p>
      {#if details.length}
        <ul class="details">
          {#each details as d (d)}<li>{d}</li>{/each}
        </ul>
      {/if}
      {#if requireText}
        <label class="confirm-type">
          <span>{t('common.typeToConfirm', { text: requireText })}</span>
          <input
            class="sw-input"
            bind:value={typed}
            placeholder={requireText}
            autocomplete="off"
            spellcheck="false"
            onkeydown={(e) => e.key === 'Enter' && confirm()}
          />
        </label>
      {/if}
      <div class="row">
        <button class="sw-btn sw-btn-ghost" onclick={onCancel}>{t('common.cancel')}</button>
        <button
          class="sw-btn {danger ? 'sw-btn-danger' : 'sw-btn-primary'}"
          disabled={blocked}
          onclick={confirm}>{confirmLabel}</button>
      </div>
    </div>
  </div>
{/if}

<style>
  .overlay {
    position: fixed;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 50;
  }
  .backdrop {
    position: absolute;
    inset: 0;
    border: none;
    padding: 0;
    background: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(2px);
    cursor: default;
  }
  .dialog {
    position: relative;
    width: min(420px, 90vw);
    background: var(--sw-bg-secondary);
    border: 1px solid var(--sw-border);
    border-radius: var(--sw-radius-lg);
    padding: var(--sw-space-6);
    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.4);
  }
  h3 {
    margin: 0 0 var(--sw-space-2);
    font-size: 1rem;
    font-weight: 600;
    color: var(--sw-text-primary);
  }
  p {
    margin: 0 0 var(--sw-space-4);
    font-size: var(--sw-text-sm);
    color: var(--sw-text-secondary);
    line-height: 1.5;
  }
  .details {
    margin: 0 0 var(--sw-space-4);
    padding: var(--sw-space-2) var(--sw-space-3);
    list-style: none;
    max-height: 180px;
    overflow: auto;
    background: var(--sw-bg-hover);
    border: 1px solid var(--sw-border);
    border-radius: var(--sw-radius-md);
    font-family: 'Cascadia Code', 'Consolas', monospace;
    font-size: var(--sw-text-xs);
    color: var(--sw-text-primary);
  }
  .details li {
    padding: 2px 0;
  }
  .confirm-type {
    display: block;
    margin: 0 0 var(--sw-space-5);
    font-size: var(--sw-text-xs);
    color: var(--sw-text-secondary);
  }
  .confirm-type .sw-input {
    width: 100%;
    margin-top: var(--sw-space-1);
  }
  .row {
    display: flex;
    justify-content: flex-end;
    gap: var(--sw-space-2);
  }
</style>
