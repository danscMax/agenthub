<script lang="ts">
  import { t } from '$lib/i18n';
  import type { SessionTool } from '$lib/ipc';

  let {
    open,
    profiles = [],
    defaultProfile = '',
    defaultCwd = '',
    onSubmit,
    onCancel
  }: {
    open: boolean;
    profiles?: string[];
    defaultProfile?: string;
    defaultCwd?: string;
    onSubmit: (v: { tool: SessionTool; profile: string; cwd: string; args: string }) => void;
    onCancel: () => void;
  } = $props();

  const TOOLS: { id: SessionTool; label: string }[] = [
    { id: 'claude', label: 'Claude' },
    { id: 'opencode', label: 'opencode' },
    { id: 'shell', label: 'shell' }
  ];

  let tool = $state<SessionTool>('claude');
  let profile = $state('');
  let cwd = $state('');
  let args = $state('');
  let seeded = '';

  $effect(() => {
    const key = `${open}:${defaultProfile}:${defaultCwd}`;
    if (open && key !== seeded) {
      tool = 'claude';
      profile = defaultProfile || profiles[0] || '';
      cwd = defaultCwd;
      args = '';
      seeded = key;
    }
  });

  const canSubmit = $derived(tool !== 'claude' || !!profile);

  function submit() {
    if (!canSubmit) return;
    onSubmit({ tool, profile: tool === 'claude' ? profile : '', cwd: cwd.trim(), args: args.trim() });
  }
</script>

<svelte:window onkeydown={(e) => open && e.key === 'Escape' && onCancel()} />

{#if open}
  <div class="overlay">
    <button type="button" class="backdrop" aria-label={t('common.cancel')} onclick={onCancel}></button>
    <div class="dialog" role="dialog" aria-modal="true" tabindex="-1">
      <h3>{t('sessions.dlgTitle')}</h3>

      <label class="fld">
        <span>{t('sessions.dlgTool')}</span>
        <div class="seg">
          {#each TOOLS as tl (tl.id)}
            <button type="button" class="seg-btn" class:sel={tool === tl.id} onclick={() => (tool = tl.id)}>
              {tl.label}
            </button>
          {/each}
        </div>
        <span class="hint">{t('sessions.dlgToolHint')}</span>
      </label>

      {#if tool === 'claude'}
        <label class="fld">
          <span>{t('sessions.dlgProfile')}</span>
          <select class="sw-input" bind:value={profile}>
            {#each profiles as p (p)}<option value={p}>{p}</option>{/each}
          </select>
        </label>
      {/if}

      <label class="fld">
        <span>{t('sessions.cwd')}</span>
        <input class="sw-input" bind:value={cwd} placeholder={t('sessions.cwdPlaceholder')} spellcheck="false" autocomplete="off" />
      </label>

      {#if tool !== 'shell'}
        <label class="fld">
          <span>{t('sessions.dlgArgs')}</span>
          <input class="sw-input font-mono text-sw-xs" bind:value={args} placeholder={t('sessions.dlgArgsPlaceholder')} spellcheck="false" autocomplete="off" />
          <span class="hint">{t('sessions.dlgArgsHint')}</span>
        </label>
      {/if}

      <div class="row">
        <button class="sw-btn sw-btn-ghost" onclick={onCancel}>{t('common.cancel')}</button>
        <button class="sw-btn sw-btn-primary" disabled={!canSubmit} onclick={submit}>{t('sessions.dlgLaunch')}</button>
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
    width: min(460px, 92vw);
    background: var(--sw-bg-secondary);
    border: 1px solid var(--sw-border);
    border-radius: var(--sw-radius-lg);
    padding: var(--sw-space-6);
    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.4);
  }
  h3 {
    margin: 0 0 var(--sw-space-4);
    font-size: 1rem;
    font-weight: 600;
    color: var(--sw-text-primary);
  }
  .fld {
    display: block;
    margin-bottom: var(--sw-space-4);
  }
  .fld > span {
    display: block;
    margin-bottom: 6px;
    font-size: var(--sw-text-xs);
    color: var(--sw-text-secondary);
  }
  .hint {
    margin-top: 4px;
    color: var(--sw-text-muted);
    font-size: var(--sw-text-xs);
  }
  .seg {
    display: flex;
    gap: 6px;
  }
  .seg-btn {
    flex: 1;
    padding: 6px 10px;
    border: 1px solid var(--sw-border);
    border-radius: var(--sw-radius-md);
    background: transparent;
    color: var(--sw-text-secondary);
    cursor: pointer;
    font-size: var(--sw-text-sm);
  }
  .seg-btn.sel {
    background: var(--sw-accent-glow);
    color: var(--sw-text-primary);
    border-color: var(--sw-accent-text);
  }
  .row {
    display: flex;
    justify-content: flex-end;
    gap: var(--sw-space-2);
    margin-top: var(--sw-space-6);
  }
</style>
