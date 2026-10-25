// Keep panel movement independent of expression storage and text selection.
export function mountExpressionPanelMove(panel: HTMLElement, heading: HTMLElement, handle: HTMLButtonElement) {
  const doc = panel.ownerDocument, win = doc.defaultView!;
  const margin = 12;
  let drag: { id: number; x: number; y: number; left: number; top: number; moved: boolean } | undefined;
  let suppressClick = false, clickTimer: ReturnType<typeof setTimeout> | undefined;
  const place = (left: number, top: number) => {
    const rect = panel.getBoundingClientRect();
    panel.style.left = `${Math.max(margin, Math.min(Math.max(margin, win.innerWidth - rect.width - margin), left))}px`;
    panel.style.top = `${Math.max(margin, Math.min(Math.max(margin, win.innerHeight - rect.height - margin), top))}px`;
  };
  const clamp = () => { if (!panel.hidden) { const rect = panel.getBoundingClientRect(); place(rect.left, rect.top); } };
  const cancel = () => {
    if (drag) { try { if (handle.hasPointerCapture?.(drag.id)) handle.releasePointerCapture(drag.id); } catch { /* capture already ended */ } }
    drag = undefined; heading.classList.remove('is-dragging'); suppressClick = false; clearTimeout(clickTimer);
  };
  const start = (event: PointerEvent) => {
    const control = (event.target as Element | null)?.closest?.('button, a, input, textarea, select, summary');
    if (event.button !== 0 || (control && control !== handle)) return;
    const rect = panel.getBoundingClientRect();
    event.preventDefault(); event.stopPropagation(); cancel(); handle.focus({ preventScroll: true });
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY, left: rect.left, top: rect.top, moved: false };
    try { handle.setPointerCapture(event.pointerId); } catch { /* document listeners also cover missing capture support */ }
  };
  const move = (event: PointerEvent) => {
    if (!drag || event.pointerId !== drag.id) return;
    const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
    if (!drag.moved && Math.hypot(dx, dy) < 4) return;
    drag.moved = true; heading.classList.add('is-dragging'); event.preventDefault();
    place(drag.left + dx, drag.top + dy);
  };
  const end = (event: PointerEvent) => {
    if (!drag || event.pointerId !== drag.id) return;
    // Pointer capture can retarget the release click to the move button even
    // when the drag began on the title. Suppress that click for either origin.
    const moved = drag.moved && event.type === 'pointerup'; cancel();
    if (moved) { suppressClick = true; clickTimer = setTimeout(() => { suppressClick = false; }, 0); }
  };
  const cycle = () => {
    if (suppressClick) { suppressClick = false; return; }
    const rect = panel.getBoundingClientRect(), right = Math.max(margin, win.innerWidth - rect.width - margin), bottom = Math.max(margin, win.innerHeight - rect.height - margin);
    const corners = [[margin, margin], [right, margin], [right, bottom], [margin, bottom]];
    const nearest = corners.reduce((best, point, index) => Math.hypot(rect.left - point[0], rect.top - point[1]) < Math.hypot(rect.left - corners[best][0], rect.top - corners[best][1]) ? index : best, 0);
    const [left, top] = corners[(nearest + 1) % corners.length]; place(left, top);
  };
  const key = (event: KeyboardEvent) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const step = event.shiftKey ? 40 : 12, rect = panel.getBoundingClientRect();
    const delta: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    if (event.key !== 'Home' && !delta[event.key]) return;
    event.preventDefault(); event.stopPropagation();
    if (event.key === 'Home') place(20, 80); else place(rect.left + delta[event.key][0], rect.top + delta[event.key][1]);
  };
  const resize = () => { cancel(); clamp(); };
  const resizeObserver = win.ResizeObserver ? new win.ResizeObserver(clamp) : undefined;
  resizeObserver?.observe(panel);
  heading.addEventListener('pointerdown', start);
  doc.addEventListener('pointermove', move); doc.addEventListener('pointerup', end); doc.addEventListener('pointercancel', end);
  handle.addEventListener('click', cycle); handle.addEventListener('keydown', key); win.addEventListener('resize', resize);
  return { clamp, cancel, dispose() {
    cancel(); resizeObserver?.disconnect(); heading.removeEventListener('pointerdown', start);
    doc.removeEventListener('pointermove', move); doc.removeEventListener('pointerup', end); doc.removeEventListener('pointercancel', end);
    handle.removeEventListener('click', cycle); handle.removeEventListener('keydown', key); win.removeEventListener('resize', resize);
  } };
}
