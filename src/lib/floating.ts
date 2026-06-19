// Pin a popover (dropdown menu / select panel / folder picker) to its anchor with
// `position: fixed`, so it escapes any overflow-clipping ancestor — scrollable tables
// (`.dt`/`.dt-scroll` clip on both axes) and modal bodies (`overflow-y: auto`). Re-pins on
// scroll/resize. The popover stays a DOM descendant of its anchor's container, so each
// component's existing "click outside → close" containment check keeps working.
//
// Assumes no ancestor establishes a fixed-positioning containing block (a persistent
// transform/filter/contain). The only animated transform in the app — ModalShell's enter —
// is non-persistent (no animation-fill-mode), so this holds once the 0.18s animation ends.
type AnchoredParams = {
  anchor: HTMLElement;
  align?: 'left' | 'right'; // which edge of the anchor the popover lines up with (default left)
  matchWidth?: boolean; // force the popover width to the anchor's (for full-width selects)
};

export function anchored(node: HTMLElement, params: AnchoredParams) {
  const MARGIN = 8;
  let p = params;

  function place() {
    if (typeof window === 'undefined' || !p.anchor) return;
    const a = p.anchor.getBoundingClientRect();
    node.style.position = 'fixed';
    node.style.left = '';
    node.style.right = '';
    if (p.matchWidth) node.style.width = `${a.width}px`;

    const w = node.offsetWidth || 200;
    const h = node.offsetHeight || 0;

    // Vertical: open below; flip above only if below would overflow the viewport bottom
    // and there's room above (fixes the clipped last-row menu in the screenshot).
    let top = a.bottom + 4;
    if (top + h > window.innerHeight - MARGIN && a.top - h - 4 >= MARGIN) {
      top = a.top - h - 4;
    }
    node.style.top = `${Math.max(MARGIN, top)}px`;

    // Horizontal: anchor to the chosen edge, then clamp into the viewport.
    if (p.align === 'right' && !p.matchWidth) {
      node.style.right = `${Math.max(MARGIN, window.innerWidth - a.right)}px`;
    } else {
      let left = a.left;
      if (left + w > window.innerWidth - MARGIN) left = window.innerWidth - MARGIN - w;
      node.style.left = `${Math.max(MARGIN, left)}px`;
    }
  }

  place();
  // capture=true so scrolling an inner overflow container (e.g. the table) re-pins too.
  const onScroll = () => place();
  window.addEventListener('scroll', onScroll, true);
  window.addEventListener('resize', onScroll);

  return {
    update(next: AnchoredParams) {
      p = next;
      place();
    },
    destroy() {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    }
  };
}
