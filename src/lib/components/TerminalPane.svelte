<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { Terminal } from '@xterm/xterm';
  import { FitAddon } from '@xterm/addon-fit';
  import { listen, type UnlistenFn } from '@tauri-apps/api/event';
  import '@xterm/xterm/css/xterm.css';
  import { sessionSpawn, sessionWrite, sessionResize, sessionKill } from '$lib/ipc';
  import { t } from '$lib/i18n';

  let {
    profile,
    cwd = undefined,
    visible = true,
    maximized = false,
    onClose,
    onToggleMax
  }: {
    profile: string;
    cwd?: string;
    visible?: boolean;
    maximized?: boolean;
    onClose: () => void;
    onToggleMax?: () => void;
  } = $props();

  let host: HTMLDivElement;
  let term: Terminal | undefined;
  let fit: FitAddon | undefined;
  let id = $state<string | null>(null);
  let exited = $state(false);
  let error = $state('');
  let unlisteners: UnlistenFn[] = [];
  let ro: ResizeObserver | undefined;

  // The PTY frames are base64 (binary-safe across multibyte/ANSI). Decode to bytes for xterm.
  function b64ToBytes(b64: string): Uint8Array {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }

  onMount(async () => {
    term = new Terminal({
      fontFamily: "'Cascadia Code', 'Consolas', monospace",
      fontSize: 12,
      cursorBlink: true,
      scrollback: 5000,
      theme: { background: '#0b0e14', foreground: '#cdd6f4' }
    });
    fit = new FitAddon();
    term.loadAddon(fit);
    term.open(host);
    try {
      fit.fit();
    } catch {
      /* host not laid out yet — resize observer fits shortly */
    }
    try {
      id = await sessionSpawn(profile, cwd, term.cols, term.rows);
    } catch (e) {
      error = String(e);
      term.writeln(`\r\n\x1b[31m${t('sessions.spawnError', { e: String(e) })}\x1b[0m`);
      return;
    }
    unlisteners.push(
      await listen<string>(`pty:data:${id}`, (ev) => term?.write(b64ToBytes(ev.payload)))
    );
    unlisteners.push(
      await listen<number>(`pty:exit:${id}`, () => {
        exited = true;
        term?.writeln(`\r\n\x1b[90m${t('sessions.ended')}\x1b[0m`);
      })
    );
    term.onData((d) => {
      if (id && !exited) sessionWrite(id, d);
    });
    ro = new ResizeObserver(() => {
      if (!term || !fit) return;
      try {
        fit.fit();
        if (id) sessionResize(id, term.cols, term.rows);
      } catch {
        /* fit can throw mid-layout; the next observation retries */
      }
    });
    ro.observe(host);
  });

  onDestroy(() => {
    ro?.disconnect();
    unlisteners.forEach((u) => u());
    if (id) sessionKill(id);
    term?.dispose();
  });

  // A hidden pane (other tab active, or another pane maximized) has zero size; when it becomes
  // visible again, re-fit and push the real dimensions to the PTY so the TUI reflows correctly.
  $effect(() => {
    visible;
    maximized;
    if (term && fit && visible) {
      requestAnimationFrame(() => {
        try {
          fit!.fit();
          if (id) sessionResize(id, term!.cols, term!.rows);
        } catch {
          /* layout not settled yet */
        }
      });
    }
  });
</script>

<div class="pane">
  <div class="bar">
    <span class="dot" class:dead={exited} class:err={!!error}></span>
    <span class="name" title={t('sessions.paneTitle', { profile })}>{profile}</span>
    <span class="spacer"></span>
    {#if onToggleMax}
      <button class="x" onclick={onToggleMax}
        title={maximized ? t('sessions.restore') : t('sessions.maximize')}
        aria-label={maximized ? t('sessions.restore') : t('sessions.maximize')}>{maximized ? '⤡' : '⤢'}</button>
    {/if}
    <button class="x" onclick={onClose} title={t('sessions.closePane')} aria-label={t('sessions.closePane')}>✕</button>
  </div>
  <div class="term" bind:this={host}></div>
</div>

<style>
  .pane {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
    border: 1px solid var(--sw-border);
    border-radius: var(--sw-radius-md);
    overflow: hidden;
    background: #0b0e14;
  }
  .bar {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 8px;
    background: var(--sw-bg-secondary);
    border-bottom: 1px solid var(--sw-border);
  }
  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #10b981;
    flex-shrink: 0;
  }
  .dot.dead {
    background: #6b7280;
  }
  .dot.err {
    background: #ef4444;
  }
  .name {
    font-size: var(--sw-text-xs);
    font-weight: 600;
    color: var(--sw-text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .spacer {
    flex: 1;
  }
  .x {
    border: none;
    background: transparent;
    color: var(--sw-text-muted);
    cursor: pointer;
    font-size: 12px;
    padding: 0 4px;
    line-height: 1;
  }
  .x:hover {
    color: var(--sw-text-primary);
  }
  .term {
    flex: 1;
    min-height: 0;
    padding: 4px;
  }
</style>
