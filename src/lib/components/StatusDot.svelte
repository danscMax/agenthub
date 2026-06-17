<script lang="ts">
  // Shared status indicator dot. Color comes from the semantic --sw-status-* tokens; size in px.
  let {
    status = 'off',
    size = 9,
    title = ''
  }: { status?: 'up' | 'degraded' | 'down' | 'off'; size?: number; title?: string } = $props();
</script>

<span class="dot {status}" style="--d:{size}px" {title} aria-label={title}></span>

<style>
  .dot {
    display: inline-block;
    width: var(--d);
    height: var(--d);
    border-radius: 50%;
    flex-shrink: 0;
    background: var(--sw-status-off);
  }
  .up {
    background: var(--sw-status-up);
  }
  .degraded {
    background: var(--sw-status-degraded);
  }
  .down {
    background: var(--sw-status-down);
  }
  .off {
    background: var(--sw-status-off);
  }
</style>
