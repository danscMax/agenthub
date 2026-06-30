<script lang="ts">
  import { t } from '$lib/i18n';
  import { statusTextClass } from '$lib/statusColor';
  import type { SyncStatus, ConfigDriftStatus, ProfilesStatus, SchedulesStatus, StackService } from '$lib/ipc';

  // USE-1: single-pane "is my Claude setup healthy?" overview. Pure aggregation of data the
  // other tabs already load; each chip deep-links to the tab that owns it.
  // F23: also a quick-action launchpad — the parent wires onAction(id) to its existing handlers.
  let {
    profiles = null,
    sync = null,
    drift = null,
    schedules = null,
    stack = null,
    sessionCount = null,
    onOpen,
    onRefresh,
    onAction
  }: {
    profiles: ProfilesStatus | null;
    sync: SyncStatus | null;
    drift: ConfigDriftStatus | null;
    schedules: SchedulesStatus | null;
    stack?: StackService[] | null;
    sessionCount?: number | null;
    onOpen: (id: string) => void;
    onRefresh?: () => void;
    onAction?: (id: string) => void;
  } = $props();

  type Level = 'ok' | 'warn' | 'bad' | 'muted';
  // F23: a chip may carry one inline action (id routed through onAction, label shown on the button).
  type Chip = { key: string; tab: string; title: string; value: string; level: Level; action?: { id: string; label: string } };

  function ageStr(h: number) {
    if (h < 1) return t('common.minutesAgo', { n: Math.max(1, Math.round(h * 60)) });
    if (h < 48) return t('common.hoursAgo', { n: Math.round(h) });
    return t('common.daysAgo', { n: Math.round(h / 24) });
  }

  const chips = $derived.by<Chip[]>(() => {
    const out: Chip[] = [];

    const b = profiles?.backup;
    out.push({
      key: 'backup', tab: 'backup', title: t('page.home_backup'),
      value: b && b.ageHours != null ? t('page.home_backupAge', { time: ageStr(b.ageHours) }) : t('page.home_noData'),
      level: !b || b.ageHours == null ? 'muted' : b.stale ? 'bad' : 'ok'
    });

    if (drift) {
      const d = drift.drifted ?? 0;
      const u = drift.unlinked ?? 0;
      out.push({
        key: 'drift', tab: 'sync', title: t('page.home_config'),
        value: d > 0 ? t('page.home_configDrifted', { n: d }) : u > 0 ? t('page.home_configUnlinked', { n: u }) : t('page.home_ok'),
        level: d > 0 ? 'bad' : u > 0 ? 'warn' : 'ok',
        // Drift/unlinked → one-click relink (parent runs the same confirmed action as the Sync tab).
        action: d > 0 || u > 0 ? { id: 'relink', label: t('page.home_relink') } : undefined
      });
    }

    if (profiles?.profiles?.length) {
      const broken = profiles.profiles.filter((p) => !p.linksIntact).length;
      out.push({
        key: 'profiles', tab: 'profiles', title: t('page.home_profiles'),
        value: broken > 0 ? t('page.home_profilesBroken', { n: broken }) : t('page.home_profilesOk', { n: profiles.profiles.length }),
        level: broken > 0 ? 'bad' : 'ok',
        // F23: one-click repair of every broken profile's links (parent loops the repair script).
        action: broken > 0 ? { id: 'repair-profiles', label: t('page.home_repairAll') } : undefined
      });
    }

    const conf = profiles?.syncConflicts?.count ?? 0;
    if (conf > 0) {
      out.push({
        key: 'conflicts', tab: 'sync', title: t('page.home_conflicts'), value: t('page.home_conflictsN', { n: conf }), level: 'warn',
        action: { id: 'clean-conflicts', label: t('page.home_cleanConflicts') }
      });
    }

    if (sync?.syncthing) {
      const st = sync.syncthing;
      out.push({
        key: 'sync', tab: 'sync', title: t('page.home_sync'),
        value: st.available ? (st.state ?? t('common.dash')) : t('page.home_syncOffline'),
        level: st.available ? (sync.stignoreMatches === false ? 'warn' : 'ok') : 'muted'
      });
    }

    if (schedules?.tasks?.length) {
      const failing = schedules.tasks.filter((x) => x.ok === false).length;
      const off = schedules.tasks.filter((x) => !x.enabled).length;
      out.push({
        key: 'schedule', tab: 'schedule', title: t('page.home_tasks'),
        value: failing > 0 ? t('page.home_tasksFailing', { n: failing }) : off > 0 ? t('page.home_tasksOff', { n: off }) : t('page.home_ok'),
        level: failing > 0 ? 'bad' : off > 0 ? 'warn' : 'ok'
      });
    }

    if (stack?.length) {
      const enabled = stack.filter((s) => s.enabled);
      const up = enabled.filter((s) => s.running).length;
      out.push({
        key: 'stack', tab: 'providers', title: t('page.home_stack'),
        value: t('page.home_stackRunning', { up, total: enabled.length }),
        level: up === 0 ? 'muted' : up < enabled.length ? 'warn' : 'ok',
        action: up === 0 ? { id: 'start-stack', label: t('page.home_stackStart') } : { id: 'stop-stack', label: t('page.home_stackStop') }
      });
    }

    if (sessionCount != null) {
      out.push({
        key: 'sessions', tab: 'sessions', title: t('page.home_sessions'),
        value: t('page.home_sessionsActive', { n: sessionCount }),
        level: sessionCount > 0 ? 'ok' : 'muted'
      });
    }

    return out;
  });

  const issues = $derived(chips.filter((c) => c.level === 'bad' || c.level === 'warn').length);
  const overall = $derived(
    chips.some((c) => c.level === 'bad' || c.level === 'warn') ? 'warn' : chips.some((c) => c.level === 'ok') ? 'ok' : 'muted'
  );

  // Theme-aware status text colour (shared source; light theme darkens to meet WCAG contrast).
  const color = (level: Level) => statusTextClass(level);
</script>

<div class="p-sw-6">
  <header class="mb-sw-4 flex items-start justify-between gap-sw-4">
    <div>
      <h1 class="text-lg font-semibold">{t('page.home_title')}</h1>
      <p class="text-sw-sm text-sw-text-secondary">{t('page.home_subtitle')}</p>
    </div>
    {#if onRefresh}
      <button class="sw-btn sw-btn-ghost shrink-0" onclick={onRefresh} title={t('common.refresh')}>{t('common.refresh')}</button>
    {/if}
  </header>

  <div class="mb-sw-4 sw-card flex flex-wrap items-center gap-sw-2">
    <span class="badge {overall === 'ok' ? 'badge-ok' : 'badge-warn'}">
      {overall === 'ok' ? t('page.home_allOk') : overall === 'muted' ? t('page.home_noData') : t('page.home_issues', { n: issues })}
    </span>
    {#if onAction}
      <!-- F23: quick actions — run the same parent handlers the dedicated tabs use. -->
      <span class="ml-auto flex flex-wrap gap-sw-2">
        <button class="sw-btn sw-btn-ghost text-sw-xs" onclick={() => onAction('check-all')}>{t('page.home_checkAll')}</button>
        <button class="sw-btn sw-btn-ghost text-sw-xs" onclick={() => onAction('refresh-forks')}>{t('page.home_refreshForks')}</button>
        <button class="sw-btn sw-btn-ghost text-sw-xs" onclick={() => onAction('start-stack')}>{t('page.home_stackStart')}</button>
        <button class="sw-btn sw-btn-ghost text-sw-xs" onclick={() => onAction('stop-stack')}>{t('page.home_stackStop')}</button>
      </span>
    {/if}
  </div>

  <div class="card-grid">
    {#each chips as c (c.key)}
      <div class="sw-card flex flex-col gap-1">
        <button class="flex flex-col gap-1 text-left" onclick={() => onOpen(c.tab)} title={t('common.open')}>
          <span class="text-sw-xs uppercase tracking-wide text-sw-text-muted">{c.title}</span>
          <span class="font-medium {color(c.level)}">{c.value}</span>
        </button>
        {#if c.action && onAction}
          <button class="sw-btn sw-btn-ghost text-sw-xs self-start" onclick={() => onAction(c.action!.id)}>{c.action.label}</button>
        {/if}
      </div>
    {/each}
  </div>
</div>
