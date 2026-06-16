<script lang="ts">
  // Minimal dependency-free sparkline: a normalized inline-SVG polyline. Colour follows the
  // accent var by default; pass `color` or set `currentColor` on a parent to override.
  let {
    points = [],
    width = 240,
    height = 40,
    color = 'var(--sw-accent)',
    title = ''
  }: {
    points?: number[];
    width?: number;
    height?: number;
    color?: string;
    title?: string;
  } = $props();

  const pad = 2; // keep the stroke off the edges
  const max = $derived(points.length ? Math.max(...points) : 0);
  const min = $derived(points.length ? Math.min(...points) : 0);

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
</script>

{#if points.length}
  <svg
    {width}
    {height}
    viewBox="0 0 {width} {height}"
    role="img"
    aria-label={title}
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
  </svg>
{/if}
