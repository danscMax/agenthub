<script lang="ts">
  // Minimal dependency-free sparkline: a normalized inline-SVG polyline. Colour follows the
  // accent var by default; pass `color` or set `currentColor` on a parent to override.
  let {
    points = [],
    width = 240,
    height = 40,
    color = 'var(--sw-accent)',
    title = '',
    peakLabel = '',
    labels = []
  }: {
    points?: number[];
    width?: number;
    height?: number;
    color?: string;
    title?: string;
    peakLabel?: string;
    // Per-bucket hover text (e.g. "14:00 · 12 req"), same length as points. When present, each
    // bucket gets a transparent hit-rect with a native <title> tooltip + a hover column highlight.
    labels?: string[];
  } = $props();

  const pad = 2; // keep the stroke off the edges
  // Reduce-based min/max (no `...points` spread) so a very large series can't blow the call
  // stack with a RangeError. Behaviour-identical to Math.min/Math.max for finite arrays.
  const extent = $derived.by(() => {
    let mn = Infinity;
    let mx = -Infinity;
    for (const v of points) {
      if (v < mn) mn = v;
      if (v > mx) mx = v;
    }
    return points.length ? { min: mn, max: mx } : { min: 0, max: 0 };
  });
  const max = $derived(extent.max);
  const min = $derived(extent.min);

  // Map each value to an (x, y) inside the padded box. A flat series (max === min) sits on a
  // mid-line rather than collapsing to the top or bottom.
  const coords = $derived.by(() => {
    const n = points.length;
    if (!n) return [] as { x: number; y: number }[];
    const span = max - min;
    const innerW = width - pad * 2;
    const innerH = height - pad * 2;
    return points.map((v, i) => {
      const x = pad + (n === 1 ? innerW / 2 : (innerW * i) / (n - 1));
      const frac = span === 0 ? 0.5 : (v - min) / span;
      const y = pad + innerH * (1 - frac);
      return { x, y };
    });
  });

  const line = $derived(coords.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' '));
  // Closed path under the line for a subtle area fill.
  const area = $derived(
    coords.length
      ? `M ${coords[0].x.toFixed(1)},${(height - pad).toFixed(1)} ` +
          `L ${line.split(' ').join(' L ')} ` +
          `L ${coords[coords.length - 1].x.toFixed(1)},${(height - pad).toFixed(1)} Z`
      : ''
  );
  const last = $derived(coords.length ? coords[coords.length - 1] : null);
  // V9: anchor the peak label at the peak itself (clamped to the box) — a fixed top-right label
  // overlapped the line whenever the series was high on the right edge.
  const peak = $derived.by(() => {
    if (!coords.length) return null;
    let idx = 0;
    for (let i = 1; i < points.length; i++) if (points[i] > points[idx]) idx = i;
    return coords[idx] ?? null;
  });
  const peakAnchor = $derived(!peak ? 'middle' : peak.x < 40 ? 'start' : peak.x > width - 40 ? 'end' : 'middle');

  // Accessible summary: screen readers get magnitude (min / max / last value) instead of just the
  // title, since the visual y-scale is otherwise only legible on hover. Kept tiny, no redesign.
  const ariaSummary = $derived(
    points.length
      ? `${title ? title + ': ' : ''}min ${min}, max ${max}, last ${points[points.length - 1]}`
      : title
  );
</script>

{#if points.length}
  <svg
    {width}
    {height}
    viewBox="0 0 {width} {height}"
    role="img"
    aria-label={ariaSummary}
    style="color: {color}; overflow: visible"
  >
    {#if title}<title>{title}</title>{/if}
    <path d={area} fill="currentColor" opacity="0.12" />
    <polyline
      points={line}
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      stroke-linejoin="round"
      stroke-linecap="round"
    />
    {#if last}<circle cx={last.x} cy={last.y} r="2" fill="currentColor" />{/if}
    {#if peakLabel && peak}
      <text x={Math.min(Math.max(peak.x, 2), width - 2)} y={Math.max(9, peak.y - 5)}
        text-anchor={peakAnchor} font-size="10" fill="currentColor" opacity="0.7">{peakLabel}</text>
    {/if}
    {#if coords.length}
      {#each coords as c, i (i)}
        <rect class="hit" x={Math.max(0, c.x - width / coords.length / 2)} y="0"
          width={width / coords.length} {height}>
          <title>{labels[i] ?? `#${i + 1}`}</title>
        </rect>
      {/each}
    {/if}
  </svg>
{/if}

<style>
  /* Transparent per-bucket hit areas: native <title> tooltip on hover + a faint column highlight. */
  .hit {
    fill: transparent;
  }
  .hit:hover {
    fill: currentColor;
    opacity: 0.08;
  }
</style>
