<script lang="ts">
  import { t } from '$lib/i18n';
  import { type SessionTool } from '$lib/ipc';
  import { ARG_PRESETS, toggleFlag } from '$lib/sessionPresets';
  import Select from './Select.svelte';
  import FolderField from './FolderField.svelte';
  import ModalShell from './ModalShell.svelte';

  let {
    open,
    profiles = [],
    defaultProfile = '',
    defaultCwd = '',
    defaultArgs = '',
    onSubmit,
    onCancel
  }: {
    open: boolean;
    profiles?: string[];
    defaultProfile?: string;
    defaultCwd?: string;
    defaultArgs?: string;
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
    const key = `${open}:${defaultProfile}:${defaultCwd}:${defaultArgs}`;
    if (open && key !== seeded) {
      tool = 'claude';
      profile = defaultProfile || profiles[0] || '';
      cwd = defaultCwd;
      args = defaultArgs;
      seeded = key;
    }
  });

  const canSubmit = $derived(tool !== 'claude' || !!profile);

  // Common launch flags as one-click chips; clicking toggles the exact flag in the args string.
  const presets = $derived(ARG_PRESETS[tool] ?? []);
  function hasArg(flag: string) {
    return args.includes(flag);
  }
  function toggleArg(flag: string) {
    args = toggleFlag(args, flag);
  }

  function submit() {
    if (!canSubmit) return;
    onSubmit({ tool, profile: tool === 'claude' ? profile : '', cwd: cwd.trim(), args: args.trim() });
  }
</script>

<ModalShell {open} onClose={onCancel} size="md">
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
        <div class="fld">
          <span class="lbl">{t('sessions.dlgProfile')}</span>
          <Select bind:value={profile} options={profiles} placeholder={t('sessions.dlgProfile')} />
        </div>
      {/if}

      <div class="fld">
        <span class="lbl">{t('sessions.cwd')}</span>
        <FolderField bind:value={cwd} placeholder={t('sessions.cwdShort')} />
      </div>

      {#if tool !== 'shell'}
        <div class="fld">
          <span class="lbl">{t('sessions.dlgArgs')}</span>
          <input class="sw-input grow font-mono text-sw-xs" bind:value={args} placeholder={t('sessions.dlgArgsPlaceholder')} spellcheck="false" autocomplete="off" />
          {#if presets.length}
            <div class="chips">
              {#each presets as flag (flag)}
                <button type="button" class="chip" class:on={hasArg(flag)} onclick={() => toggleArg(flag)}>{flag}</button>
              {/each}
            </div>
          {/if}
          <span class="hint">{t('sessions.dlgArgsHint')}</span>
        </div>
      {/if}

      <div class="row">
        <button class="sw-btn sw-btn-ghost" onclick={onCancel}>{t('common.cancel')}</button>
        <button class="sw-btn sw-btn-primary" disabled={!canSubmit} onclick={submit}>{t('sessions.dlgLaunch')}</button>
      </div>
</ModalShell>

<style>
  .lbl {
    display: block;
    margin-bottom: 6px;
    font-size: var(--sw-text-xs);
    color: var(--sw-text-secondary);
  }
  .grow {
    flex: 1;
    min-width: 0;
    width: 100%;
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 8px;
  }
  .chip {
    padding: 3px 8px;
    border: 1px solid var(--sw-border);
    border-radius: 9999px;
    background: transparent;
    color: var(--sw-text-muted);
    font-family: 'Cascadia Code', 'Consolas', monospace;
    font-size: 11px;
    cursor: pointer;
  }
  .chip:hover {
    color: var(--sw-text-secondary);
  }
  .chip.on {
    background: var(--sw-accent-glow);
    color: var(--sw-text-primary);
    border-color: var(--sw-accent-text);
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
