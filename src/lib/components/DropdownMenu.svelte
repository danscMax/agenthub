<script lang="ts">
  type Item = {
    label: string;
    title?: string;
    onClick: () => void;
    disabled?: boolean;
    danger?: boolean;
  };
  let {
    label,
    title,
    items,
    align = 'right',
    variant = 'ghost',
    disabled = false
  }: {
    label?: string;
    title?: string;
    items: Item[];
    align?: 'left' | 'right';
    variant?: 'ghost' | 'primary';
    disabled?: boolean;
  } = $props();

  let open = $state(false);
  let root = $state<HTMLElement | undefined>();
  // Side the menu actually opens to — recomputed by chooseSide() in toggle() before the menu
  // is shown, so it never spills off-screen (e.g. under the sidebar) regardless of the column.
  // The literal init is never rendered (resolved is only read inside {#if open}).
  let resolved = $state<'left' | 'right'>('right');

  // Pick the side with enough room. 'right' anchors right:0 (opens leftward) and needs space
  // to the left down to the content edge (sidebar width); 'left' anchors left:0 (opens
  // rightward) and needs space to the viewport's right edge. Prefer the configured `align`,
  // flip only when it wouldn't fit.
  function chooseSide(): 'left' | 'right' {
    if (!root || typeof window === 'undefined') return align;
    const r = root.getBoundingClientRect();
    const MENU_W = 200; // min-width 180 + padding/buffer
    const MARGIN = 8;
    // Real content-left edge in px = right edge of the sidebar (its width is in rem, so measure
    // the element rather than parse the CSS var). Falls back to the viewport edge if absent.
    const sidebar = document.querySelector('.sidebar');
    const leftBound = (sidebar ? sidebar.getBoundingClientRect().right : 0) + MARGIN;
    const rightBound = window.innerWidth - MARGIN;
    const fitsOpeningRight = r.left + MENU_W <= rightBound; // align='left'
    const fitsOpeningLeft = r.right - MENU_W >= leftBound; // align='right'
    if (align === 'right') return fitsOpeningLeft ? 'right' : fitsOpeningRight ? 'left' : 'right';
    return fitsOpeningRight ? 'left' : fitsOpeningLeft ? 'right' : 'left';
  }

  function toggle() {
    if (disabled) return;
    open = !open;
    if (open) resolved = chooseSide();
  }
  function pick(it: Item) {
    if (it.disabled) return;
    open = false;
    it.onClick();
  }
  function onDocClick(e: MouseEvent) {
    if (open && root && !root.contains(e.target as Node)) open = false;
  }
</script>

<svelte:window onclick={onDocClick} onkeydown={(e) => e.key === 'Escape' && (open = false)} />

<div class="dd" bind:this={root}>
  <button
    class="sw-btn text-sw-xs {variant === 'primary' ? '' : 'sw-btn-ghost'}"
    {disabled}
    onclick={toggle}
    {title}
    aria-haspopup="menu"
    aria-expanded={open}
  >
    {#if label}{label} <span class="caret">▾</span>{:else}<span class="dots">⋯</span>{/if}
  </button>
  {#if open}
    <div class="menu {resolved}" role="menu">
      {#each items as it (it.label)}
        <button
          class="item"
          class:danger={it.danger}
          disabled={it.disabled}
          role="menuitem"
          title={it.title}
          onclick={() => pick(it)}
        >
          {it.label}
        </button>
      {/each}
    </div>
  {/if}
</div>

<style>
  .dd {
    position: relative;
    display: inline-block;
  }
  .caret {
    opacity: 0.7;
    font-size: 0.8em;
  }
  .dots {
    font-size: 1.1em;
    line-height: 1;
    letter-spacing: 1px;
  }
  .menu {
    position: absolute;
    top: calc(100% + 4px);
    min-width: 180px;
    z-index: 30;
    display: flex;
    flex-direction: column;
    padding: 4px;
    background: var(--sw-bg-secondary);
    border: 1px solid var(--sw-border);
    border-radius: var(--sw-radius-md);
    box-shadow: 0 12px 30px rgba(0, 0, 0, 0.4);
  }
  .menu.right {
    right: 0;
  }
  .menu.left {
    left: 0;
  }
  .item {
    text-align: left;
    padding: 6px 10px;
    border: none;
    background: transparent;
    color: var(--sw-text-primary);
    border-radius: var(--sw-radius-sm);
    font-size: var(--sw-text-xs);
    cursor: pointer;
    white-space: nowrap;
  }
  .item:hover:not(:disabled) {
    background: var(--sw-bg-tertiary, rgba(255, 255, 255, 0.06));
  }
  .item:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
  .item.danger {
    color: var(--sw-danger);
  }
</style>
