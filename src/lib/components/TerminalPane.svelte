<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { Terminal } from '@xterm/xterm';
  import { FitAddon } from '@xterm/addon-fit';
  import { listen, type UnlistenFn } from '@tauri-apps/api/event';
  import '@xterm/xterm/css/xterm.css';
  import { sessionSpawn, sessionWrite, sessionResize, sessionKill, type SessionTool } from '$lib/ipc';
  import { t } from '$lib/i18n';

  let {
    profile,
    tool = 'claude',
    args = '',
    cwd = undefined,
    paneKey = '',
    visible = true,
    maximized = false,
    onClose,
    onToggleMax,
    onDuplicate,
    onDragStart,
    onDragEnter,
    onDrop
  }: {
    profile: string;
    tool?: SessionTool;
    args?: string;
    cwd?: string;
    paneKey?: string;
    visible?: boolean;
    maximized?: boolean;
    onClose: () => void;
    onToggleMax?: () => void;
    onDuplicate?: () => void;
    onDragStart?: (key: string) => void;
    onDragEnter?: (key: string) => void;
    onDrop?: () => void;
  } = $props();

  // Pane title: tool + the profile (claude) or the folder it's running in (opencode/shell).
  const folderName = $derived(cwd ? cwd.replace(/[\\/]+$/, '').split(/[\\/]/).pop() || cwd : '');
  const label = $derived(
    tool === 'claude' ? `${tool} · ${profile}` : folderName ? `${tool} · ${folderName}` : tool
  );

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

  const FONT_KEY = 'cmh-sessions-fontsize';
  let fontSize = $state(13);

  function refit() {
    if (!term || !fit) return;
    try {
      fit.fit();
      if (id) sessionResize(id, term.cols, term.rows);
    } catch {
      /* layout not settled yet — the next observation retries */
    }
  }
  function zoom(delta: number) {
    fontSize = Math.min(28, Math.max(8, fontSize + delta));
    if (term) term.options.fontSize = fontSize;
    try {
      localStorage.setItem(FONT_KEY, String(fontSize));
    } catch {
      /* ignore */
    }
    refit();
  }
  function onWheel(e: WheelEvent) {
    if (!e.ctrlKey) return; // plain wheel → xterm scrollback
    e.preventDefault();
    zoom(e.deltaY < 0 ? 1 : -1);
  }

  // Spawn the session and wire its streams. Re-runnable so a finished pane can relaunch in place.
  async function start() {
    if (!term) return;
    exited = false;
    error = '';
    refit();
    try {
      id = await sessionSpawn(profile, tool, args, cwd, term.cols, term.rows);
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
  }

  async function relaunch() {
    unlisteners.forEach((u) => u());
    unlisteners = [];
    if (id) {
      sessionKill(id);
      id = null;
    }
    term?.reset();
    await start();
  }

  onMount(async () => {
    try {
      const f = Number(localStorage.getItem(FONT_KEY));
      if (f >= 8 && f <= 28) fontSize = f;
    } catch {
      /* ignore */
    }
    term = new Terminal({
      fontFamily: "'Cascadia Code', 'Consolas', monospace",
      fontSize,
      cursorBlink: true,
      scrollback: 5000,
      theme: { background: '#0b0e14', foreground: '#cdd6f4' }
    });
    fit = new FitAddon();
    term.loadAddon(fit);
    term.open(host);
    // Keystrokes read `id`/`exited` live, so this single handler survives a relaunch.
    term.onData((d) => {
      if (id && !exited) sessionWrite(id, d);
    });
    ro = new ResizeObserver(() => refit());
    ro.observe(host);
    await start();
  });

  onDestroy(() => {
    ro?.disconnect();
    unlisteners.forEach((u) => u());
    if (id) sessionKill(id);
    term?.dispose();
  });

  // A hidden pane (other tab active, or another pane maximized) has zero size; re-fit when shown.
  $effect(() => {
    visible;
    maximized;
    if (term && fit && visible) requestAnimationFrame(() => refit());
  });
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="pane"
  ondragover={(e) => onDragEnter && e.preventDefault()}
  ondragenter={() => onDragEnter?.(paneKey)}
  ondrop={(e) => {
    if (!onDrop) return;
    e.preventDefault();
    onDrop();
  }}
>
  <!-- The bar doubles as the drag handle (xterm keeps the terminal area for selection). -->
  <div
    class="bar"
    draggable={!!onDragStart}
    ondragstart={() => onDragStart?.(paneKey)}
    title={onDragStart ? t('sessions.dragHint') : undefined}
  >
    <span class="dot" class:dead={exited} class:err={!!error}></span>
    <span class="name" title={cwd || t('sessions.paneTitle', { profile: label })}>{label}</span>
    <span class="spacer"></span>
    {#if exited}
      <button class="x relaunch" onclick={relaunch} title={t('sessions.relaunch')}>↻ {t('sessions.relaunch')}</button>
    {/if}
    <button class="x" onclick={() => zoom(-1)} title={t('sessions.zoomOut')} aria-label={t('sessions.zoomOut')}>A−</button>
    <button class="x" onclick={() => zoom(1)} title={t('sessions.zoomIn')} aria-label={t('sessions.zoomIn')}>A+</button>
    {#if onDuplicate}
      <button class="x" onclick={onDuplicate} title={t('sessions.duplicate')} aria-label={t('sessions.duplicate')}>⧉</button>
    {/if}
    {#if onToggleMax}
      <button class="x" onclick={onToggleMax}
        title={maximized ? t('sessions.restore') : t('sessions.maximize')}
        aria-label={maximized ? t('sessions.restore') : t('sessions.maximize')}>{maximized ? '⤡' : '⤢'}</button>
    {/if}
    <button class="x" onclick={onClose} title={t('sessions.closePane')} aria-label={t('sessions.closePane')}>✕</button>
  </div>
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="term" bind:this={host} onwheel={onWheel}></div>
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
  .bar[draggable='true'] {
    cursor: grab;
  }
  .bar[draggable='true']:active {
    cursor: grabbing;
  }
  .relaunch {
    width: auto;
    padding: 0 6px;
    color: var(--sw-accent-text);
    font-size: 11px;
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
