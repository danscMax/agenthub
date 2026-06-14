<script lang="ts">
  // Small CSS ring spinner. Used for the per-tab "refreshing" overlay and sidebar rows.
  let { size = 16, stroke = 2 }: { size?: number; stroke?: number } = $props();
</script>

<span class="spinner" style="width:{size}px;height:{size}px;border-width:{stroke}px;" aria-hidden="true"></span>

<style>
  .spinner {
    display: inline-block;
    flex-shrink: 0;
    border-style: solid;
    border-color: var(--sw-border);
    border-top-color: var(--sw-accent);
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
  }
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
