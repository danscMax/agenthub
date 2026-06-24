<script lang="ts">
  import '../app.css';
  import { onMount } from 'svelte';
  import { getCurrentWindow } from '@tauri-apps/api/window';
  import { initTheme } from '$lib/theme';
  import { initLocale } from '$lib/i18n';
  import WindowTitleBar from '$lib/components/WindowTitleBar.svelte';
  import DetachedView from '$lib/components/DetachedView.svelte';

  let { children } = $props();

  // Detached per-monitor / popped-out windows (label != "main") render ONLY the mirrored pane —
  // never the full tabbed UI — so +page's data-fetching never runs in them.
  let isDetached = $state(false);
  try {
    isDetached = getCurrentWindow().label !== 'main';
  } catch {
    isDetached = false;
  }

  onMount(() => {
    initTheme();
    initLocale();
  });
</script>

{#if isDetached}
  <DetachedView />
{:else}
  <div class="flex h-screen flex-col overflow-hidden">
    <WindowTitleBar />
    <div class="min-h-0 flex-1 overflow-hidden">
      {@render children()}
    </div>
  </div>
{/if}
