<script lang="ts">
  // Password-style input with a reveal (eye) toggle + copy button. Used for API keys/tokens (#10).
  import { t } from '$lib/i18n';
  import { copyText } from '$lib/clipboard';

  let {
    value = $bindable(''),
    placeholder = '',
    disabled = false,
    title = ''
  }: {
    value?: string;
    placeholder?: string;
    disabled?: boolean;
    title?: string;
  } = $props();

  let show = $state(false);
  let copied = $state(false);
  async function copy() {
    if (value && (await copyText(value))) {
      copied = true;
      setTimeout(() => (copied = false), 1200);
    }
  }
</script>

<div class="secret">
  <input
    class="sw-input"
    type={show ? 'text' : 'password'}
    bind:value
    {placeholder}
    {disabled}
    {title}
    autocomplete="off"
    spellcheck="false"
  />
  <!-- Buttons only matter for a value being typed: a saved key isn't sent to the UI (it lives in
       Credential Manager), so the field shows a masked placeholder with nothing to reveal/copy. -->
  {#if value}
    <button type="button" class="sbtn" onclick={() => (show = !show)}
      title={show ? t('common.hide') : t('common.show')} aria-label={show ? t('common.hide') : t('common.show')}>
      {show ? '🙈' : '👁'}
    </button>
    <button type="button" class="sbtn" onclick={copy}
      title={t('common.copy')} aria-label={t('common.copy')}>{copied ? '✓' : '⧉'}</button>
  {/if}
</div>

<style>
  .secret {
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .secret input {
    flex: 1;
    min-width: 0;
  }
  .sbtn {
    flex-shrink: 0;
    border: 1px solid var(--sw-border);
    background: var(--sw-bg-hover);
    color: var(--sw-text-secondary);
    border-radius: var(--sw-radius-sm);
    padding: 0 8px;
    height: 32px;
    cursor: pointer;
    font-size: 13px;
  }
  .sbtn:hover:not(:disabled) {
    color: var(--sw-text-primary);
    border-color: var(--sw-border-focus);
  }
  .sbtn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
</style>
