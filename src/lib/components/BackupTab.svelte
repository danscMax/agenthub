<script lang="ts">
  import { onMount } from 'svelte';
  import type { BackupList, BackupAction, RestoreOpts } from '$lib/ipc';
  import { revealBackup } from '$lib/ipc';
  import RestoreDialog from './RestoreDialog.svelte';
  import EmptyState from './EmptyState.svelte';
  import { Archive } from '@lucide/svelte';
  import SectionHeader from './SectionHeader.svelte';
  import { t } from '$lib/i18n';
  import { pushToast } from '$lib/toast.svelte';
  import { formatAbsTime } from '$lib/relativeTime';

  let {
    data,
    running,
    log = [],
    profiles = [],
    onAction
  }: {
    data: BackupList | null;
    running: string | null;
    log?: string[];
    profiles?: string[];
    onAction: (action: BackupAction, opts?: RestoreOpts) => void;
  } = $props();

  const busy = $derived(!!running);
  const snapshots = $derived(data?.snapshots ?? []);
  const weeklies = $derived(data?.weeklies ?? []);
  const bstate = $derived(data?.state ?? null);

  let restoreSnap = $state<string | null>(null);

  // #101: how many snapshots to retain (passed to Backup-ClaudeSetup.ps1 -KeepSnapshots).
  let keepSnapshots = $state(30);
  onMount(() => {
    try {
      const v = Number(localStorage.getItem('cmh-backup-keep'));
      if (v >= 1) keepSnapshots = v;
    } catch {
      /* ignore */
    }
  });
  function doBackup() {
    try {
      localStorage.setItem('cmh-backup-keep', String(keepSnapshots));
    } catch {
      /* ignore */
    }
    onAction('backup', { keepSnapshots });
  }

  // "2026-06-12_100002" -> "2026-06-12 10:00:02" (snapshot-name format). Returns null if it
  // isn't that format, so callers can fall back.
  function snapToReadable(name: string): string | null {
    const m = name.match(/^(\d{4})-(\d{2})-(\d{2})_(\d{2})(\d{2})(\d{2})$/);
    return m ? `${m[1]}-${m[2]}-${m[3]} ${m[4]}:${m[5]}:${m[6]}` : null;
  }
  function fmtSnap(name: string) {
    return snapToReadable(name) ?? name;
  }
  // "weekly-2026-06-15.zip" -> "2026-06-15" (falls back to the raw name).
  function fmtWeekly(name: string): string {
    return name.match(/^weekly-(\d{4}-\d{2}-\d{2})\.zip$/)?.[1] ?? name;
  }

  // Absolute timestamp — see formatAbsTime in $lib/relativeTime (guards the Invalid-Date leak).
  // snapToReadable covers the snapshot-name format (e.g. lastWeekly) that isn't ISO-parseable.
  const fmtAbs = (ts?: string | null) => formatAbsTime(ts, snapToReadable);

  const freshness = $derived.by(() => {
    if (!bstate?.lastRun) return { label: t('common.noData'), cls: 'badge-muted', rel: '' };
    const last = new Date(bstate.lastRun).getTime();
    if (Number.isNaN(last)) return { label: t('common.noData'), cls: 'badge-muted', rel: '' };
    const days = (Date.now() - last) / 86_400_000;
    const rel =
      days < 1
        ? t('backup.relToday')
        : days < 2
          ? t('backup.relYesterday')
          : t('backup.relDaysAgo', { n: Math.floor(days) });
    if (days <= 2) return { label: t('backup.fresh'), cls: 'badge-ok', rel };
    if (days <= 7) return { label: t('backup.staling'), cls: 'badge-warn', rel };
    return { label: t('backup.stale'), cls: 'badge-err', rel };
  });
</script>

<div class="p-sw-6">
  <header class="mb-sw-4 flex items-start justify-between gap-sw-4">
    <div>
      <h1 class="text-lg font-semibold">{t('backup.title')}</h1>
      <p class="text-sw-sm text-sw-text-secondary">{t('backup.subtitle')}</p>
    </div>
    <div class="flex shrink-0 items-center gap-sw-3">
      <label class="flex items-center gap-sw-2 text-sw-xs text-sw-text-muted" title={t('backup.retentionTip')}>
        {t('backup.retention')}
        <input type="number" min="1" max="200" class="sw-input w-20 text-sw-sm" bind:value={keepSnapshots} />
      </label>
      <button class="sw-btn sw-btn-primary" disabled={busy} onclick={doBackup}
        title={t('backup.createTitle')}>
        {running === 'backup' ? t('common.busy') : t('backup.makeBackup')}
      </button>
    </div>
  </header>

  {#if data === null}
    <div class="flex flex-col gap-sw-2">
      {#each Array(4) as _, i (i)}
        <div class="skeleton" style="height:2.4rem"></div>
      {/each}
    </div>
  {:else}
  <!-- status -->
  <div class="sw-card mb-sw-4 flex flex-wrap items-center gap-sw-6">
    <div>
      <span class="badge {freshness.cls}">{freshness.label}</span>
    </div>
    <dl class="grid flex-1 grid-cols-2 gap-x-sw-6 gap-y-1 text-sw-sm md:grid-cols-4">
      <div>
        <dt class="text-sw-xs text-sw-text-muted">{t('backup.lastBackup')}</dt>
        <dd class="text-sw-text">{fmtAbs(bstate?.lastRun)}{freshness.rel ? ` · ${freshness.rel}` : ''}</dd>
      </div>
      <div>
        <dt class="text-sw-xs text-sw-text-muted">{t('backup.lastSnapshot')}</dt>
        <dd class="text-sw-text">{bstate?.lastSnapshot ? fmtSnap(bstate.lastSnapshot) : '—'}</dd>
      </div>
      <div>
        <dt class="text-sw-xs text-sw-text-muted">{t('backup.snapshotsWeekly')}</dt>
        <dd class="text-sw-text">{snapshots.length} / {weeklies.length}</dd>
      </div>
      <div>
        <dt class="text-sw-xs text-sw-text-muted">{t('backup.weeklyArchive')}</dt>
        <dd class="text-sw-text">{fmtAbs(bstate?.lastWeekly)}</dd>
      </div>
    </dl>
  </div>

  <!-- snapshots -->
  <SectionHeader title={t('backup.snapshotsHeading', { n: snapshots.length })} />
  {#if snapshots.length}
    <ul class="flex flex-col gap-sw-2">
      {#each snapshots as snap, i (snap)}
        <li class="sw-card flex items-center justify-between gap-sw-4 py-sw-2">
          <div class="flex items-center gap-sw-2">
            <span class="font-mono text-sw-sm text-sw-text">{fmtSnap(snap)}</span>
            {#if i === 0}<span class="badge badge-info">{t('backup.latest')}</span>{/if}
          </div>
          <div class="flex shrink-0 gap-sw-2">
            <button class="sw-btn sw-btn-ghost text-sw-xs" disabled={busy} onclick={() => (restoreSnap = snap)}
              title={t('backup.restoreItemTitle')}>{t('backup.restore')}</button>
            <button class="sw-btn sw-btn-ghost text-sw-xs" disabled={busy}
              onclick={() => onAction('delete-snapshot', { timestamp: snap })}
              title={t('backup.deleteItemTitle')}>{t('common.delete')}</button>
          </div>
        </li>
      {/each}
    </ul>
  {:else}
    <EmptyState icon={Archive} title={t('backup.emptyTitle')} description={t('backup.emptyHint')} />
  {/if}

  <!-- weekly archives (F9): list the weekly-*.zip files the count above only summarised. These are
       zip archives, not snapshot folders, so the only action offered is reveal-in-Explorer. -->
  {#if weeklies.length}
    <div class="mt-sw-6">
      <SectionHeader title={t('backup.weekliesHeading', { n: weeklies.length })} />
      <ul class="flex flex-col gap-sw-2">
        {#each weeklies as wk, i (wk)}
          <li class="sw-card flex items-center justify-between gap-sw-4 py-sw-2">
            <div class="flex items-center gap-sw-2">
              <span class="font-mono text-sw-sm text-sw-text">{fmtWeekly(wk)}</span>
              {#if i === 0}<span class="badge badge-info">{t('backup.latest')}</span>{/if}
            </div>
            <div class="flex shrink-0 gap-sw-2">
              <button class="sw-btn sw-btn-ghost text-sw-xs"
                onclick={() => revealBackup(wk).catch((e) => pushToast({ kind: 'error', title: String(e) }))}
                title={t('backup.revealItemTitle')}>{t('common.open')}</button>
            </div>
          </li>
        {/each}
      </ul>
    </div>
  {/if}
  {/if}
</div>

<RestoreDialog
  open={restoreSnap !== null}
  snapshot={restoreSnap ?? ''}
  {busy}
  {log}
  {profiles}
  onPreview={(opts) => onAction('restore-preview', opts)}
  onRestore={(opts) => onAction('restore', opts)}
  onClose={() => (restoreSnap = null)}
/>
