<#
  fork-sync — entry point (Phase 1: read-only fork status reporter).
  Thin wrapper: sets UTF-8, takes a single-instance lock, imports the core
  module, runs Invoke-ForkSync, returns its exit code.

  Usage:
    .\update-forks.bat                  # pretty, interactive (double-click)
    pwsh -File .\update-forks.ps1       # same, from a shell
    pwsh -File .\update-forks.ps1 -NoFetch      # offline: use already-fetched refs
    pwsh -File .\update-forks.ps1 -Unattended   # no toast/prompts (scheduler)
#>
[CmdletBinding()]
param(
    [switch]$Unattended,
    [switch]$NoFetch,
    [string[]]$Roots,
    [string[]]$Paths,
    [int]$FetchTimeoutSec,
    [int]$GhTimeoutSec,
    # Phase 2 — safe mutations (all backed up; never auto force-push):
    [switch]$Apply,            # = -FfMain -DeleteMerged together
    [switch]$FfMain,           # fast-forward behind default branches
    [switch]$DeleteMerged,     # delete merged topic branches (local + fork)
    [switch]$NormalizeRemotes, # rename remotes to canon (origin=fork, upstream=original)
    [switch]$Rebase,           # rebase open PR branches onto fresh upstream (local; conflict→abort)
    [switch]$SyncWipLocal,     # rebase the personal wip-local branch onto fresh upstream (local; no push)
    [switch]$PushRebased,      # after rebase, force-with-lease push to update the PRs (asks)
    [switch]$DryRun,           # with an action flag: print the plan, change nothing
    [switch]$Yes               # skip confirmations (for scripting / the skill)
)

chcp 65001 | Out-Null
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Import-Module (Join-Path $PSScriptRoot 'ForkSync.psm1') -Force

# Single-instance lock — concurrent runs doing git in the same repos is unsafe.
$lockPath = Join-Path $env:TEMP 'fork-sync.lock'
$lockStream = $null
try {
    try { $lockStream = [System.IO.File]::Open($lockPath, 'OpenOrCreate', 'ReadWrite', 'None') }
    catch {
        Write-Host '  [!!] fork-sync уже запущен (lock занят). Выходим.' -ForegroundColor Red
        exit 3
    }

    $code = Invoke-ForkSync -Root $PSScriptRoot -Unattended:$Unattended -NoFetch:$NoFetch `
        -Roots $Roots -Paths $Paths -FetchTimeoutSec $FetchTimeoutSec -GhTimeoutSec $GhTimeoutSec `
        -Apply:$Apply -FfMain:$FfMain -DeleteMerged:$DeleteMerged -NormalizeRemotes:$NormalizeRemotes `
        -Rebase:$Rebase -SyncWipLocal:$SyncWipLocal -PushRebased:$PushRebased -DryRun:$DryRun -Yes:$Yes

    exit ([int]$code)
}
finally {
    if ($lockStream) { $lockStream.Close(); $lockStream.Dispose() }
    Remove-Item -LiteralPath $lockPath -ErrorAction SilentlyContinue
}
