<script lang="ts">
  // Pill toggle switch (Sweet Whisper style). Two-way bindable `checked`, plus an optional
  // `onCheckedChange` callback for side effects (so callers don't need a raw checkbox).
  let {
    checked = $bindable(false),
    disabled = false,
    title = '',
    onCheckedChange
  }: {
    checked?: boolean;
    disabled?: boolean;
    title?: string;
    onCheckedChange?: (checked: boolean) => void;
  } = $props();

  function toggle() {
    if (disabled) return;
    checked = !checked;
    onCheckedChange?.(checked);
  }
</script>

<button
  type="button"
  class="tgl"
  class:on={checked}
  {disabled}
  {title}
  role="switch"
  aria-checked={checked}
  onclick={toggle}
>
  <span class="knob"></span>
</button>

<style>
  .tgl {
    position: relative;
    width: 38px;
    height: 22px;
    flex-shrink: 0;
    border-radius: 999px;
    border: 1px solid var(--sw-border);
    background: var(--sw-bg-hover);
    cursor: pointer;
    padding: 0;
    transition: background 0.15s ease, border-color 0.15s ease;
  }
  .tgl.on {
    background: var(--sw-accent);
    border-color: var(--sw-accent);
  }
  .tgl:disabled {
    opacity: 0.5;
    cursor: default;
  }
  .knob {
    position: absolute;
    top: 2px;
    left: 2px;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: #fff;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.4);
    transition: transform 0.15s ease;
  }
  .tgl.on .knob {
    transform: translateX(16px);
  }
</style>
