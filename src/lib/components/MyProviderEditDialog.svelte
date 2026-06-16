<script lang="ts">
  import type { MyProvider, MyProviderInput } from '$lib/ipc';
  import { t } from '$lib/i18n';

  let {
    open,
    current,
    profiles = [],
    onSubmit,
    onCancel
  }: {
    open: boolean;
    current: MyProvider | null;
    profiles?: string[];
    onSubmit: (p: MyProviderInput, apiKey: string) => void;
    onCancel: () => void;
  } = $props();

  let name = $state('');
  let baseUrl = $state('');
  let protocol = $state<'anthropic' | 'openai'>('openai');
  let model = $state('');
  let smallModel = $state('');
  let connectVia = $state<'freellmapi' | 'direct'>('freellmapi');
  let targetProfile = $state('');
  let apiKey = $state('');
  let seeded = '';

  $effect(() => {
    const key = `${open}:${current?.id ?? ''}`;
    if (open && key !== seeded) {
      name = current?.name ?? '';
      baseUrl = current?.baseUrl ?? '';
      protocol = current?.protocol ?? 'openai';
      model = current?.model ?? '';
      smallModel = current?.smallModel ?? '';
      connectVia = current?.connectVia ?? 'freellmapi';
      targetProfile = current?.targetProfile ?? '';
      apiKey = '';
      seeded = key;
    }
  });

  function isValidUrl(s: string): boolean {
    try {
      const u = new URL(s);
      return u.protocol === 'http:' || u.protocol === 'https:';
    } catch {
      return false;
    }
  }
  // direct + openai can't reach Claude Code (needs ccr, currently broken) — flag at the UI.
  const directOpenaiBlocked = $derived(connectVia === 'direct' && protocol === 'openai');
  const needsProfile = $derived(connectVia === 'direct');
  const canSubmit = $derived(
    !!name.trim() && isValidUrl(baseUrl.trim()) && (!needsProfile || !!targetProfile)
  );

  function submit() {
    if (!canSubmit) return;
    onSubmit(
      {
        id: current?.id,
        name: name.trim(),
        baseUrl: baseUrl.trim(),
        protocol,
        model: model.trim(),
        smallModel: smallModel.trim(),
        connectVia,
        targetProfile: needsProfile ? targetProfile : ''
      },
      apiKey.trim()
    );
  }
</script>

<svelte:window onkeydown={(e) => open && e.key === 'Escape' && onCancel()} />

{#if open}
  <div class="overlay">
    <button type="button" class="backdrop" aria-label={t('myProviders.dialogClose')} onclick={onCancel}></button>
    <div class="dialog" role="dialog" aria-modal="true" tabindex="-1">
      <h3>{current?.id ? t('myProviders.editTitle') : t('myProviders.addTitle')}</h3>

      <label class="fld">
        <span>{t('myProviders.name')}</span>
        <input class="sw-input" bind:value={name} placeholder="DeepSeek" autocomplete="off" />
      </label>

      <label class="fld">
        <span>{t('myProviders.baseUrl')}</span>
        <input class="sw-input" bind:value={baseUrl} placeholder="https://api.deepseek.com/v1" spellcheck="false" autocomplete="off" />
        {#if baseUrl.trim() && !isValidUrl(baseUrl.trim())}
          <span class="warn">{t('myProviders.errInvalidUrl')}</span>
        {/if}
      </label>

      <div class="two">
        <label class="fld">
          <span>{t('myProviders.protocol')}</span>
          <select class="sw-input" bind:value={protocol}>
            <option value="openai">OpenAI</option>
            <option value="anthropic">Anthropic</option>
          </select>
        </label>
        <label class="fld">
          <span>{t('myProviders.connectVia')}</span>
          <select class="sw-input" bind:value={connectVia}>
            <option value="freellmapi">{t('myProviders.viaFreellmapi')}</option>
            <option value="direct">{t('myProviders.viaDirect')}</option>
          </select>
        </label>
      </div>

      {#if needsProfile}
        <label class="fld">
          <span>{t('myProviders.targetProfile')}</span>
          <select class="sw-input" bind:value={targetProfile}>
            <option value="" disabled>{t('myProviders.targetProfilePlaceholder')}</option>
            {#each profiles as p (p)}<option value={p}>{p}</option>{/each}
          </select>
        </label>
      {/if}

      {#if directOpenaiBlocked}
        <p class="warn">{t('myProviders.openaiNeedsRouter')}</p>
      {/if}

      <div class="two">
        <label class="fld">
          <span>{t('myProviders.model')}</span>
          <input class="sw-input" bind:value={model} placeholder="deepseek-chat" spellcheck="false" />
        </label>
        <label class="fld">
          <span>{t('myProviders.smallModel')}</span>
          <input class="sw-input" bind:value={smallModel} placeholder="—" spellcheck="false" />
        </label>
      </div>

      <label class="fld">
        <span>{t('myProviders.apiKey')}</span>
        <input class="sw-input" type="password" bind:value={apiKey} autocomplete="off"
          placeholder={current?.hasKey ? t('myProviders.apiKeyKeep') : t('myProviders.apiKeyPlaceholder')} />
      </label>

      <div class="row">
        <button class="sw-btn sw-btn-ghost" onclick={onCancel}>{t('myProviders.cancel')}</button>
        <button class="sw-btn sw-btn-primary" disabled={!canSubmit} onclick={submit}>{t('myProviders.save')}</button>
      </div>
    </div>
  </div>
{/if}

<style>
  .overlay {
    position: fixed;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 50;
  }
  .backdrop {
    position: absolute;
    inset: 0;
    border: none;
    padding: 0;
    background: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(2px);
    cursor: default;
  }
  .dialog {
    position: relative;
    width: min(480px, 94vw);
    background: var(--sw-bg-secondary);
    border: 1px solid var(--sw-border);
    border-radius: var(--sw-radius-lg);
    padding: var(--sw-space-6);
    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.4);
  }
  h3 {
    margin: 0 0 var(--sw-space-4);
    font-size: 1rem;
    font-weight: 600;
    color: var(--sw-text-primary);
  }
  .fld {
    display: block;
    margin-bottom: var(--sw-space-3);
  }
  .fld > span {
    display: block;
    margin-bottom: 6px;
    font-size: var(--sw-text-xs);
    color: var(--sw-text-secondary);
  }
  .two {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--sw-space-3);
  }
  .warn {
    margin-top: 4px;
    color: #f59e0b;
    font-size: var(--sw-text-xs);
  }
  .row {
    display: flex;
    justify-content: flex-end;
    gap: var(--sw-space-2);
    margin-top: var(--sw-space-6);
  }
</style>
