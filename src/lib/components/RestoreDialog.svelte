<script lang="ts">
  import type { RestoreOpts } from '$lib/ipc';
  import { t } from '$lib/i18n';
  import Toggle from './Toggle.svelte';
  import ModalShell from './ModalShell.svelte';

  let {
    open,
    snapshot,
    busy,
    profiles = [],
    onPreview,
    onRestore,
    onClose
  }: {
    open: boolean;
    snapshot: string;
    busy: boolean;
    profiles?: string[];
    onPreview: (opts: RestoreOpts) => void;
    onRestore: (opts: RestoreOpts) => void;
    onClose: () => void;
  } = $props();

  // Real profile list from the backup payload; falls back to the canonical set on first paint.
  const FALLBACK = ['ccmy', 'cc1', 'cc2', 'cc3', 'cc4', 'cc5'];
  const list = $derived(profiles.length ? profiles : FALLBACK);
  let sel = $state<Record<string, boolean>>({});
  let includeCreds = $state(false);
  let hasPreviewed = $state(false);

  // Default every (newly seen) profile to selected.
  $effect(() => {
    for (const p of list) if (sel[p] === undefined) sel[p] = true;
  });
  const selected = $derived(list.filter((p) => sel[p]));
  const allOn = $derived(list.length > 0 && list.every((p) => sel[p]));
  function setAll(v: boolean) {
    for (const p of list) sel[p] = v;
    hasPreviewed = false;
  }

  // New snapshot => force a fresh preview before a real restore is allowed.
  $effect(() => {
    void snapshot;
    hasPreviewed = false;
  });

  function toggle(p: string) {
    sel[p] = !sel[p];
    hasPreviewed = false; // selection changed -> preview is stale
  }
  function toggleCreds(v: boolean) {
    includeCreds = v;
    hasPreviewed = false;
  }

  function opts(): RestoreOpts {
    return { timestamp: snapshot, profiles: selected, includeCredentials: includeCreds };
  }
  function preview() {
    onPreview(opts());
    hasPreviewed = true;
  }
  function restore() {
    onRestore(opts());
  }
</script>

<ModalShell {open} onClose={onClose} size="sm">
      <h3>{t('backup.dialogTitle')}</h3>
      <p class="snap">{snapshot}</p>

      <div class="section">
        <div class="section-head">
          <span class="section-title">{t('backup.profiles')}</span>
          <button class="selall" onclick={() => setAll(!allOn)}>
            {allOn ? t('common.deselectAll') : t('common.selectAll')}
          </button>
        </div>
        <div class="profiles">
          {#each list as p (p)}
            <button type="button" class="pchip" class:on={sel[p]} onclick={() => toggle(p)}
              title={t('backup.profileToggleTip')}>{p}</button>
          {/each}
        </div>
      </div>

      <label class="creds">
        <Toggle checked={includeCreds} onCheckedChange={toggleCreds} title={t('backup.includeCredsTip')} />
        <span>{t('backup.includeCreds')}</span>
      </label>

      <p class="warn">
        {t('backup.warn')}
      </p>

      <div class="row">
        <button class="sw-btn sw-btn-ghost" onclick={onClose} title={t('backup.closeTitle')}>{t('common.close')}</button>
        <button class="sw-btn sw-btn-ghost" disabled={busy || selected.length === 0} onclick={preview}
          title={t('backup.previewTitle')}>
          {t('backup.showPlan')}
        </button>
        <button
          class="sw-btn sw-btn-danger"
          disabled={busy || !hasPreviewed || selected.length === 0}
          onclick={restore}
          title={hasPreviewed
            ? t('backup.restoreTitle')
            : t('backup.restoreNeedsPreview')}
        >
          {t('backup.restore')}
        </button>
      </div>
</ModalShell>

<style>
  h3 {
    margin: 0 0 var(--sw-space-1);
    font-size: 1rem;
    font-weight: 600;
    color: var(--sw-text-primary);
  }
  .snap {
    margin: 0 0 var(--sw-space-4);
    font-family: monospace;
    font-size: var(--sw-text-sm);
    color: var(--sw-text-secondary);
  }
  .section {
    margin-bottom: var(--sw-space-4);
  }
  .section-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    margin-bottom: var(--sw-space-2);
  }
  .section-title {
    font-size: var(--sw-text-xs);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--sw-text-muted);
  }
  .selall {
    border: none;
    background: transparent;
    color: var(--sw-accent-text);
    cursor: pointer;
    font-size: var(--sw-text-xs);
    padding: 0;
  }
  .selall:hover {
    text-decoration: underline;
  }
  .profiles {
    display: flex;
    flex-wrap: wrap;
    gap: var(--sw-space-2);
  }
  .pchip {
    padding: 4px 12px;
    border: 1px solid var(--sw-border);
    border-radius: 9999px;
    background: transparent;
    color: var(--sw-text-secondary);
    font-size: var(--sw-text-sm);
    cursor: pointer;
  }
  .pchip:hover {
    color: var(--sw-text-primary);
  }
  .pchip.on {
    background: var(--sw-accent-glow);
    color: var(--sw-text-primary);
    border-color: var(--sw-accent);
  }
  .creds {
    display: flex;
    align-items: center;
    gap: var(--sw-space-2);
    margin-bottom: var(--sw-space-4);
    font-size: var(--sw-text-sm);
    color: var(--sw-text);
    cursor: pointer;
  }
  .warn {
    margin: 0 0 var(--sw-space-6);
    font-size: var(--sw-text-sm);
    color: #fbbf24;
    line-height: 1.5;
  }
  .row {
    display: flex;
    justify-content: flex-end;
    gap: var(--sw-space-2);
  }
</style>
