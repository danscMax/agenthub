<script lang="ts">
  import { t } from '$lib/i18n';
  import ModalShell from './ModalShell.svelte';
  let { open, onClose }: { open: boolean; onClose: () => void } = $props();
  // U5: grouped by SCOPE — Alt+1-3 / Ctrl+]/[ only work on the Sessions tab and Ctrl+Shift+F/T
  // only inside a focused terminal; the flat list used to present them as global.
  const groups = $derived([
    {
      title: t('page.hkScopeGlobal'),
      rows: [
        { k: 'Ctrl + K', d: t('page.hkPalette') },
        { k: 'Ctrl + 1 … 9', d: t('page.hkTabJump') },
        { k: 'Esc', d: t('page.hkCancel') },
        { k: 'Ctrl + Shift + Backspace', d: t('page.hkCancelAll') },
        { k: '?', d: t('page.hkHelp') }
      ]
    },
    {
      title: t('page.hkScopeSessions'),
      rows: [
        { k: 'Ctrl + Shift + T', d: t('page.hkNewSession') },
        { k: 'Alt + 1 / 2 / 3', d: t('page.hkColumns') },
        { k: 'Ctrl + ] / [', d: t('page.hkFocusPane') }
      ]
    },
    {
      title: t('page.hkScopeTerminal'),
      rows: [
        { k: 'Ctrl + Shift + F', d: t('page.hkFind') },
        { k: 'Ctrl+C / V · Shift+Ins', d: t('page.hkCopyPaste') }
      ]
    }
  ]);
</script>

<ModalShell {open} onClose={onClose} size="sm">
      <h3>{t('page.hkTitle')}</h3>
      {#each groups as g (g.title)}
        <p class="scope">{g.title}</p>
        <dl class="rows">
          {#each g.rows as r (r.k)}
            <div class="row"><kbd>{r.k}</kbd><span>{r.d}</span></div>
          {/each}
        </dl>
      {/each}
      <div class="foot">
        <button class="sw-btn sw-btn-ghost" onclick={onClose}>{t('common.close')}</button>
      </div>
</ModalShell>

<style>
  h3 {
    margin: 0 0 var(--sw-space-4);
    font-size: var(--sw-text-lg);
    font-weight: 600;
    color: var(--sw-text-primary);
  }
  .scope {
    margin: var(--sw-space-3) 0 var(--sw-space-2);
    font-size: var(--sw-text-xs);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--sw-text-muted);
  }
  .rows {
    display: flex;
    flex-direction: column;
    gap: var(--sw-space-2);
  }
  .row {
    display: flex;
    align-items: center;
    gap: var(--sw-space-4);
    font-size: var(--sw-text-sm);
    color: var(--sw-text-secondary);
  }
  kbd {
    flex-shrink: 0;
    min-width: 130px;
    font-family: 'Cascadia Code', 'Consolas', monospace;
    font-size: var(--sw-text-xs);
    color: var(--sw-text-primary);
    background: var(--sw-input-bg);
    border: 1px solid var(--sw-border);
    border-radius: var(--sw-radius-sm, 6px);
    padding: 2px 6px;
  }
  .foot {
    display: flex;
    justify-content: flex-end;
    margin-top: var(--sw-space-6);
  }
</style>
