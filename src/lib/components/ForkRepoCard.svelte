<script lang="ts">
  import type { ForkRepo, ForkAction } from '$lib/ipc';
  import { openTerminal } from '$lib/ipc';
  import { pConflict, pBranch, pCommit, outcomeLabel, t } from '$lib/i18n';
  import DropdownMenu from './DropdownMenu.svelte';
  import { copyText } from '$lib/clipboard';

  let {
    repo,
    anyRunning,
    run,
    onAction,
    onCancel,
    onOpenSession,
    refreshing = false
  }: {
    repo: ForkRepo;
    anyRunning: boolean;
    run?: { line: string; running: boolean; code: number | null };
    onAction: (action: ForkAction, path: string, label: string) => void;
    onCancel?: () => void;
    onOpenSession?: (path: string) => void;
    // A whole-stack forks "check" is in flight: this card's status is being refreshed.
    refreshing?: boolean;
  } = $props();

  let open = $state(false);
  let copied = $state(false);

  // This repo's own run state (concurrent, independent of other repos).
  const busy = $derived(!!run?.running);
  const lastCode = $derived(run && !run.running ? run.code : null);

  const branches = $derived(repo.branches ?? []);
  const conflictBranches = $derived(branches.filter((b) => b.outcome === 'conflict'));

  function aiPrompt(): string {
    const lines = conflictBranches.map(
      (b) =>
        t('forks.promptBranchLine', { name: b.name }) +
        (b.prNumber ? t('forks.promptPrSuffix', { n: b.prNumber }) : '') +
        (b.conflictFiles?.length
          ? t('forks.promptConflictFiles', { files: b.conflictFiles.join(', ') })
          : '')
    );
    return [
      t('forks.promptRepo', { name: repo.Name, path: repo.Path }),
      t('forks.promptRemotes', {
        upstream: repo.upstream ?? t('common.dash'),
        fork: repo.fork ?? t('common.dash'),
        branch: repo.defaultBranch ?? t('common.dash')
      }),
      '',
      t('forks.promptTask'),
      ...lines,
      '',
      t('forks.promptInstructions', { branch: repo.defaultBranch ?? 'main' })
    ].join('\n');
  }

  // Prompt for a repo with uncommitted/untracked changes — ask Claude Code to sort them out.
  function dirtyPrompt(): string {
    return [
      t('forks.promptRepo', { name: repo.Name, path: repo.Path }),
      t('forks.promptRemotes', {
        upstream: repo.upstream ?? t('common.dash'),
        fork: repo.fork ?? t('common.dash'),
        branch: repo.defaultBranch ?? t('common.dash')
      }),
      '',
      t('forks.promptTaskDirty'),
      '',
      t('forks.promptInstructionsDirty')
    ].join('\n');
  }

  async function flashCopy(text: string) {
    if (await copyText(text)) {
      copied = true;
      setTimeout(() => (copied = false), 1500);
    }
  }
  const copyPrompt = () => flashCopy(aiPrompt());
  const copyDirtyPrompt = () => flashCopy(dirtyPrompt());
  const isDirty = $derived(repo.dirty || repo.untracked);
  const hasMerged = $derived(branches.some((b) => b.outcome === 'merged'));
  const hasClean = $derived(branches.some((b) => b.outcome === 'clean'));
  const safeTree = $derived(!repo.midOp && !repo.detached);
  // How far the personal wip-local integration branch trails upstream (separate from the
  // default branch's behindBy — a repo sitting on wip-local can be behind while main is synced).
  const wipBehind = $derived(repo.wipLocal?.behindBy ?? 0);
  const wipMerged = $derived(repo.wipLocal?.mergedPatches ?? 0);
  // " · "-joined detail line for the expanded view (built in script to avoid Svelte
  // whitespace-collapsing the separator between inline {#if} blocks).
  const wipDetail = $derived(
    [
      wipBehind > 0 ? t('forks.wipBehindRow', { n: wipBehind, commits: pCommit(wipBehind) }) : null,
      wipMerged > 0 ? t('forks.wipMergedPatches', { n: wipMerged }) : null
    ]
      .filter(Boolean)
      .join(' · ')
  );

  const canFf = $derived((repo.behindBy ?? 0) > 0 && repo.ffSafe && !repo.dirty && safeTree);
  const canDelete = $derived(hasMerged && safeTree);
  const canRebase = $derived(!repo.dirty && hasClean && safeTree);
  const canNormalize = $derived(safeTree);
  // wip-local can be synced (rebased onto fresh upstream) when it trails and the tree is safe.
  const canSyncWip = $derived(wipBehind > 0 && !repo.dirty && safeTree);

  // Single recommended next action for this repo (the "what do I do now" answer).
  const rec = $derived.by(() => {
    if (repo.midOp || repo.detached)
      return { key: 'manual', plain: t('forks.recManualPlain'), label: t('forks.recManualLabel'), tip: t('forks.recManualTip'), run: () => onOpenSession?.(repo.Path), disabled: false };
    if (conflictBranches.length)
      return { key: 'conflict', plain: t('forks.recConflictPlain'), label: copied ? t('forks.recConflictCopied') : t('forks.recConflictLabel'), tip: t('forks.recConflictTip'), run: copyPrompt, disabled: false };
    if (!repo.isOwn && canFf)
      return { key: 'ff', plain: t('forks.recFfPlain', { n: repo.behindBy ?? 0, commits: pCommit(repo.behindBy ?? 0) }), label: t('forks.recFfLabel'), tip: ffTip(), run: () => onAction('ff', repo.Path, t('forks.labelFf', { name: repo.Name, branch: repo.defaultBranch ?? '' })), disabled: anyRunning || busy };
    if (!repo.isOwn && canDelete)
      return { key: 'delete', plain: t('forks.recDeletePlain'), label: t('forks.recDeleteLabel'), tip: delTip, run: () => onAction('delete', repo.Path, t('forks.labelDelete', { name: repo.Name })), disabled: anyRunning || busy };
    if (canSyncWip)
      return { key: 'syncwip', plain: t('forks.recSyncWipPlain', { n: wipBehind }), label: t('forks.recSyncWipLabel'), tip: t('forks.recSyncWipTip'), run: () => onAction('sync-wip', repo.Path, t('forks.labelSyncWip', { name: repo.Name })), disabled: anyRunning || busy };
    // Fallback for repos with local work but no sync action: uncommitted/untracked changes.
    if (isDirty)
      return { key: 'dirty', plain: t('forks.recDirtyPlain'), label: copied ? t('forks.recDirtyCopied') : t('forks.recDirtyLabel'), tip: t('forks.recDirtyTip'), run: copyDirtyPrompt, disabled: false };
    return null;
  });

  const health = $derived.by(() => {
    if (repo.Skipped === 'error') return { label: t('forks.healthAnalysisError'), cls: 'badge-err', tip: t('forks.healthAnalysisErrorTip') };
    if (repo.Skipped) return { label: repo.Skipped, cls: 'badge-muted', tip: t('forks.healthSkippedTip') };
    if (repo.midOp) return { label: repo.opName ?? t('forks.healthOpName'), cls: 'badge-warn', tip: t('forks.healthOpTip') };
    if (repo.detached) return { label: t('forks.healthDetached'), cls: 'badge-warn', tip: t('forks.healthDetachedTip') };
    const conflicts = branches.filter((b) => b.outcome === 'conflict').length;
    if (conflicts > 0) return { label: `${conflicts} ${pConflict(conflicts)}`, cls: 'badge-warn', tip: t('forks.healthConflictTip') };
    if ((repo.behindBy ?? 0) > 0) return { label: t('forks.healthBehind', { n: repo.behindBy ?? 0, commits: pCommit(repo.behindBy ?? 0) }), cls: 'badge-info', tip: t('forks.healthBehindTip', { n: repo.behindBy ?? 0 }) };
    if (wipBehind > 0) return { label: t('forks.wipBehind', { n: wipBehind, commits: pCommit(wipBehind) }), cls: 'badge-info', tip: t('forks.wipBehindTip', { n: wipBehind, commits: pCommit(wipBehind) }) };
    return { label: t('forks.healthClean'), cls: 'badge-ok', tip: t('forks.healthCleanTip') };
  });

  function prBadge(state: string | null) {
    switch (state) {
      case 'OPEN': return { label: t('forks.prOpen'), cls: 'badge-info' };
      case 'MERGED': return { label: t('forks.prMerged'), cls: 'badge-ok' };
      case 'CLOSED': return { label: t('forks.prClosed'), cls: 'badge-muted' };
      default: return null;
    }
  }

  function ffTip() {
    if (!canFf) {
      if ((repo.behindBy ?? 0) === 0) return t('forks.ffTipNotBehind');
      if (repo.dirty) return t('forks.ffTipDirty');
      if (!repo.ffSafe) return t('forks.ffTipDiverged');
      return t('forks.ffTipUnavailable');
    }
    return t('forks.ffTip', { branch: repo.defaultBranch ?? '' });
  }
  const delTip = $derived(canDelete ? t('forks.delTip') : t('forks.delTipUnavailable'));
  const rebaseTip = $derived(canRebase ? t('forks.rebaseTip') : repo.dirty ? t('forks.rebaseTipDirty') : t('forks.rebaseTipUnavailable'));
  const syncWipTip = $derived(
    canSyncWip
      ? t('forks.syncWipTip')
      : wipBehind === 0
        ? t('forks.syncWipTipSynced')
        : repo.dirty
          ? t('forks.syncWipTipDirty')
          : t('forks.syncWipTipUnavailable')
  );
  const normTip = $derived(t('forks.normTip'));
</script>

<div class="sw-card flex flex-col gap-sw-2" class:fork-busy={busy} class:fork-refreshing={refreshing && !busy}>
  <div class="flex items-start justify-between gap-sw-2">
    <button class="flex min-w-0 items-center gap-sw-2 text-left" onclick={() => (open = !open)} title={open ? t('forks.collapseTip') : t('forks.expandTip')}>
      <span class="text-sw-text-muted">{open ? '▾' : '▸'}</span>
      <div class="min-w-0">
        <div class="flex items-center gap-sw-2">
          {#if busy}<span class="busy-dot shrink-0" title={t('common.busy')}></span>{/if}
          <h3 class="truncate font-medium">{repo.Name}</h3>
          <span class="badge {repo.isOwn ? 'badge-muted' : 'badge-info'}" title={repo.isOwn ? t('forks.badgeOwnTip') : t('forks.badgeForkTip')}>{repo.isOwn ? t('forks.badgeOwn') : t('forks.badgeFork')}</span>
        </div>
        <p class="truncate text-sw-xs text-sw-text-muted">
          {repo.defaultBranch ?? t('common.dash')}{repo.currentBranch && repo.currentBranch !== repo.defaultBranch ? t('forks.onBranch', { branch: repo.currentBranch }) : ''}
          · {branches.length} {pBranch(branches.length)}
        </p>
      </div>
    </button>
    <span class="badge {health.cls} shrink-0" title={health.tip}>{health.label}</span>
  </div>

  {#if repo.dirty || repo.untracked || repo.rolesGuessed}
    <div class="flex flex-wrap gap-sw-2 text-sw-xs">
      {#if repo.dirty}<span class="badge badge-warn" title={t('forks.badgeDirtyTip')}>{t('forks.badgeDirty')}</span>{/if}
      {#if repo.untracked}<span class="badge badge-muted" title={t('forks.badgeUntrackedTip')}>{t('forks.badgeUntracked')}</span>{/if}
      {#if repo.rolesGuessed}<span class="badge badge-muted" title={t('forks.badgeRolesGuessedTip')}>{t('forks.badgeRolesGuessed')}</span>{/if}
    </div>
  {/if}

  {#if open}
    <dl class="space-y-1 border-t border-sw-border pt-sw-2 text-sw-xs text-sw-text-secondary">
      {#if repo.upstream}
        <div class="flex justify-between gap-sw-2"><dt>{t('forks.upstream')}</dt><dd class="truncate text-sw-text" title={t('forks.upstreamTip')}>{repo.upstream}</dd></div>
      {/if}
      {#if repo.fork}
        <div class="flex justify-between gap-sw-2"><dt>{t('forks.fork')}</dt><dd class="truncate text-sw-text" title={t('forks.forkTip')}>{repo.fork}</dd></div>
      {/if}
      {#if wipDetail}
        <div class="flex justify-between gap-sw-2">
          <dt>{t('forks.wipLabel')}</dt>
          <dd class="text-sw-text" title={t('forks.wipBehindTip', { n: wipBehind, commits: pCommit(wipBehind) })}>{wipDetail}</dd>
        </div>
      {/if}
    </dl>

    {#if branches.length}
      <ul class="flex flex-col gap-sw-2 border-t border-sw-border pt-sw-2">
        {#each branches as b (b.name)}
          {@const ob = outcomeLabel(b.outcome)}
          {@const pb = prBadge(b.prState)}
          <li class="text-sw-sm">
            <div class="flex flex-wrap items-center gap-sw-2">
              <span class="font-mono text-sw-text">{b.name}</span>
              <span class="badge {ob.cls}" title={t('forks.outcomeTip')}>{ob.label}</span>
              {#if pb}
                {#if b.url}
                  <a class="badge {pb.cls} hover:underline" href={b.url} target="_blank" rel="noreferrer" title={t('forks.prLinkTip')}>{pb.label}{b.prNumber ? ` #${b.prNumber}` : ''}</a>
                {:else}
                  <span class="badge {pb.cls}">{pb.label}{b.prNumber ? ` #${b.prNumber}` : ''}</span>
                {/if}
              {/if}
              {#if b.aheadOfUpstream && b.aheadOfUpstream > 0}<span class="text-sw-xs text-sw-text-muted" title={t('forks.branchAheadTip', { n: b.aheadOfUpstream })}>{t('forks.branchAhead', { n: b.aheadOfUpstream })}</span>{/if}
              {#if b.checks && b.checks !== 'none'}<span class="text-sw-xs text-sw-text-muted" title={t('forks.ciTip')}>{t('forks.ciLabel', { checks: b.checks })}</span>{/if}
            </div>
            {#if b.action}<p class="text-sw-xs text-sw-text-muted">{b.action}</p>{/if}
            {#if b.conflictFiles?.length}
              <p class="text-sw-xs text-red-400">{t('forks.conflictInFiles', { files: b.conflictFiles.join(', ') })}</p>
            {/if}
          </li>
        {/each}
      </ul>
    {:else}
      <p class="border-t border-sw-border pt-sw-2 text-sw-xs text-sw-text-muted">{t('forks.noTopicBranches')}</p>
    {/if}
  {/if}

  {#if !repo.Skipped}
    <div class="flex flex-col gap-sw-2 border-t border-sw-border pt-sw-2">
      {#if rec}
        <p class="text-sw-xs text-sw-text-secondary">
          {t('forks.recommended')} <span class="font-medium text-sw-text">{rec.plain}</span>
        </p>
      {/if}
      <div class="flex flex-wrap items-center gap-sw-2">
        {#if rec}
          <button class="sw-btn {rec.key === 'delete' ? 'sw-btn-danger' : 'sw-btn-primary'} text-sw-xs" disabled={rec.disabled} title={rec.tip} onclick={rec.run}>
            {rec.label}
          </button>
        {/if}
        {#if rec?.key !== 'manual'}
          <button class="sw-btn sw-btn-ghost text-sw-xs" onclick={() => onOpenSession?.(repo.Path)}
            title={t('forks.terminalTip')}>
            {t('forks.terminal')}
          </button>
        {/if}
        <DropdownMenu
          title={t('forks.moreActionsTip')}
          items={[
            { label: t('forks.externalTerminal'), title: t('forks.externalTerminalTip'), onClick: () => openTerminal(repo.Path) },
            ...(repo.isOwn
              ? []
              : [
                  { label: t('forks.actionFf'), title: ffTip(), disabled: anyRunning || busy || !canFf, onClick: () => onAction('ff', repo.Path, t('forks.labelFf', { name: repo.Name, branch: repo.defaultBranch ?? '' })) },
                  { label: t('forks.actionDelete'), title: delTip, disabled: anyRunning || busy || !canDelete, danger: true, onClick: () => onAction('delete', repo.Path, t('forks.labelDelete', { name: repo.Name })) },
                  { label: t('forks.actionRebase'), title: rebaseTip, disabled: anyRunning || busy || !canRebase, onClick: () => onAction('rebase', repo.Path, t('forks.labelRebase', { name: repo.Name })) },
                  { label: t('forks.actionSyncWip'), title: syncWipTip, disabled: anyRunning || busy || !canSyncWip, onClick: () => onAction('sync-wip', repo.Path, t('forks.labelSyncWip', { name: repo.Name })) },
                  { label: t('forks.actionNormalize'), title: normTip, disabled: anyRunning || busy || !canNormalize, onClick: () => onAction('normalize', repo.Path, t('forks.labelNormalize', { name: repo.Name })) }
                ])
          ]}
        />
      </div>
      {#if run}
        <div class="flex items-center gap-sw-2 text-sw-xs">
          {#if busy}
            <span class="fork-spin" aria-hidden="true"></span>
            <span class="min-w-0 flex-1 truncate text-sw-text-secondary" title={run.line}>{run.line || t('forks.runStarting')}</span>
            {#if onCancel}<button class="sw-btn sw-btn-ghost text-sw-xs shrink-0" onclick={onCancel} title={t('forks.runCancelTip')}>{t('forks.runCancel')}</button>{/if}
          {:else}
            <span class="shrink-0 {lastCode === 0 ? 'text-emerald-500' : 'text-red-500'}">{lastCode === 0 ? '✓' : '✗'}</span>
            <span class="min-w-0 flex-1 truncate text-sw-text-muted" title={run.line}>{lastCode === 0 ? t('forks.runDone') : t('forks.runFailed', { code: lastCode ?? -1 })}</span>
          {/if}
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .fork-spin {
    width: 12px;
    height: 12px;
    flex-shrink: 0;
    border-radius: 9999px;
    border: 2px solid var(--sw-border);
    border-top-color: var(--sw-accent);
    animation: fork-spin 0.7s linear infinite;
  }
  @keyframes fork-spin {
    to {
      transform: rotate(360deg);
    }
  }

  /* This repo is being mutated right now (ff/delete/rebase/sync) — strong accent glow. */
  .fork-busy {
    border-color: var(--sw-accent-text);
    box-shadow:
      0 0 0 1px var(--sw-accent-text),
      0 0 14px -2px var(--sw-accent-glow);
  }
  .busy-dot {
    width: 8px;
    height: 8px;
    border-radius: 9999px;
    background: var(--sw-accent-text);
    animation: busypulse 1s ease-in-out infinite;
  }
  /* A whole-stack check is refreshing this card's status — gentle pulse so it reads as "updating". */
  .fork-refreshing {
    animation: forkpulse 1.5s ease-in-out infinite;
  }
  @keyframes busypulse {
    0%,
    100% {
      opacity: 1;
      transform: scale(1);
    }
    50% {
      opacity: 0.4;
      transform: scale(0.8);
    }
  }
  @keyframes forkpulse {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.62;
    }
  }
</style>
