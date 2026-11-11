/**
 * Soft edge mask applied with CSS so the compositor does the fade for free.
 * Two linear gradients (left/right and top/bottom) composite to a frame that
 * is opaque at the screen edges and fully transparent across the centre.
 */
export function applyEdgeMask(el: HTMLElement, bandX: number, bandY: number): void {
  const edge = (dir: string, b: number): string => {
    const solid = (b * 0.2).toFixed(1);
    const mid = (b * 0.6).toFixed(1);
    const end = b.toFixed(1);
    return (
      `linear-gradient(${dir}, #000 0px, #000 ${solid}px, rgba(0,0,0,0.4) ${mid}px, transparent ${end}px, ` +
      `transparent calc(100% - ${end}px), rgba(0,0,0,0.4) calc(100% - ${mid}px), #000 calc(100% - ${solid}px), #000 100%)`
    );
  };
  const value = `${edge('to right', bandX)}, ${edge('to bottom', bandY)}`;
  el.style.setProperty('mask-image', value);
  el.style.setProperty('-webkit-mask-image', value);
}

export function clearEdgeMask(el: HTMLElement): void {
  el.style.removeProperty('mask-image');
  el.style.removeProperty('-webkit-mask-image');
}
