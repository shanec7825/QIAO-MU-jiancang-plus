// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { mountExpressionPanelMove } from './expression-panel-move';

let panel: HTMLElement, heading: HTMLElement, handle: HTMLButtonElement, close: HTMLButtonElement;
let controls: ReturnType<typeof mountExpressionPanelMove>, resized: () => void, disconnected: ReturnType<typeof vi.fn>;
let width = 400, height = 260;
const pointer = (target: EventTarget, type: string, x: number, y: number, pointerId = 1, button = 0) => {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, button });
  Object.defineProperty(event, 'pointerId', { value: pointerId }); target.dispatchEvent(event);
};
const key = (value: string, shiftKey = false) => handle.dispatchEvent(new KeyboardEvent('keydown', { key: value, shiftKey, bubbles: true, cancelable: true }));
beforeEach(() => {
  vi.stubGlobal('innerWidth', 1000); vi.stubGlobal('innerHeight', 800); width = 400; height = 260;
  disconnected = vi.fn();
  vi.stubGlobal('ResizeObserver', class { constructor(callback: () => void) { resized = callback; } observe() {} disconnect = disconnected; });
  document.body.innerHTML = '<section><header><button class="move">Move</button><h2>Expressions</h2><button class="close">Close</button></header><textarea></textarea></section>';
  panel = document.querySelector('section')!; heading = document.querySelector('header')!; handle = document.querySelector('.move')!; close = document.querySelector('.close')!;
  panel.style.left = '20px'; panel.style.top = '80px';
  vi.spyOn(panel, 'getBoundingClientRect').mockImplementation(() => ({ left: parseFloat(panel.style.left), top: parseFloat(panel.style.top), width, height }) as DOMRect);
  controls = mountExpressionPanelMove(panel, heading, handle);
});
afterEach(() => { controls.dispose(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it('captures the title drag on the heading and keeps the full panel in the viewport', () => {
  heading.setPointerCapture = vi.fn(); heading.hasPointerCapture = vi.fn(() => true); heading.releasePointerCapture = vi.fn();
  pointer(heading.querySelector('h2')!, 'pointerdown', 100, 100);
  pointer(document, 'pointermove', 350, 240); pointer(document, 'pointerup', 350, 240);
  expect(heading.setPointerCapture).toHaveBeenCalledWith(1); expect(heading.releasePointerCapture).toHaveBeenCalledWith(1);
  expect(panel.style.left).toBe('270px'); expect(panel.style.top).toBe('220px');
  pointer(heading, 'pointerdown', 300, 240); pointer(document, 'pointermove', 2000, 2000);
  expect(panel.style.left).toBe('588px'); expect(panel.style.top).toBe('528px');
  pointer(document, 'pointermove', -2000, -2000); expect(panel.style.left).toBe('12px'); expect(panel.style.top).toBe('12px');
});
it('ignores another pointer and an accidental movement below the drag threshold', () => {
  pointer(handle, 'pointerdown', 30, 90); pointer(document, 'pointermove', 100, 150, 2); pointer(document, 'pointerup', 100, 150, 2);
  pointer(document, 'pointermove', 32, 91); expect(panel.style.left).toBe('20px'); expect(panel.style.top).toBe('80px');
  pointer(document, 'pointermove', 50, 120); expect(panel.style.left).toBe('40px'); expect(panel.style.top).toBe('110px');
});
it('does not start a drag on close, annotation input, or the secondary mouse button', () => {
  pointer(close, 'pointerdown', 400, 80); pointer(document, 'pointermove', 600, 200);
  pointer(document.querySelector('textarea')!, 'pointerdown', 200, 200); pointer(document, 'pointermove', 600, 300);
  pointer(heading, 'pointerdown', 30, 90, 1, 2); pointer(document, 'pointermove', 600, 400);
  expect(panel.style.left).toBe('20px'); expect(panel.style.top).toBe('80px');
});
it('provides a click alternative that visits all four corners', () => {
  const positions: string[] = [];
  for (let index = 0; index < 4; index++) { handle.click(); positions.push(`${panel.style.left},${panel.style.top}`); }
  expect(positions).toEqual(['588px,12px', '588px,528px', '12px,528px', '12px,12px']);
});
it('does not also switch corners after dragging the move button', () => {
  pointer(handle, 'pointerdown', 30, 90); pointer(document, 'pointermove', 200, 190); pointer(document, 'pointerup', 200, 190);
  handle.click(); expect(panel.style.left).toBe('190px'); expect(panel.style.top).toBe('180px');
  handle.click(); expect(panel.style.left).toBe('588px'); expect(panel.style.top).toBe('12px');
});
it('suppresses the captured release click when a drag started on the title', () => {
  pointer(heading.querySelector('h2')!, 'pointerdown', 100, 100); pointer(document, 'pointermove', 250, 190); pointer(document, 'pointerup', 250, 190);
  handle.click(); expect(panel.style.left).toBe('170px'); expect(panel.style.top).toBe('170px');
});
it('supports arrow keys, larger Shift steps, and Home without affecting page shortcuts', () => {
  const listener = vi.fn(); document.addEventListener('keydown', listener);
  try { key('ArrowRight'); key('ArrowDown', true); expect(panel.style.left).toBe('32px'); expect(panel.style.top).toBe('120px'); expect(listener).not.toHaveBeenCalled(); key('Home'); expect(panel.style.left).toBe('20px'); expect(panel.style.top).toBe('80px'); }
  finally { document.removeEventListener('keydown', listener); }
});
it('clamps after resizing the viewport or expanding a passage', () => {
  handle.click(); handle.click(); vi.stubGlobal('innerWidth', 600); vi.stubGlobal('innerHeight', 450); window.dispatchEvent(new Event('resize'));
  expect(panel.style.left).toBe('188px'); expect(panel.style.top).toBe('178px');
  height = 400; resized(); expect(panel.style.top).toBe('38px');
});
it('cancels a drag on pointer cancellation or when the panel is hidden', () => {
  pointer(handle, 'pointerdown', 30, 90); pointer(document, 'pointermove', 50, 120); pointer(document, 'pointercancel', 50, 120);
  pointer(document, 'pointermove', 500, 500); expect(panel.style.left).toBe('40px');
  pointer(handle, 'pointerdown', 50, 120); controls.cancel(); panel.hidden = true;
  pointer(document, 'pointermove', 500, 500); resized(); expect(panel.style.left).toBe('40px');
});
it('releases capture and removes movement listeners when disposed', () => {
  handle.setPointerCapture = vi.fn(); handle.hasPointerCapture = vi.fn(() => true); handle.releasePointerCapture = vi.fn();
  pointer(handle, 'pointerdown', 30, 90); controls.dispose();
  expect(handle.releasePointerCapture).toHaveBeenCalledWith(1); expect(disconnected).toHaveBeenCalled();
  pointer(document, 'pointermove', 600, 500); handle.click(); key('ArrowRight'); window.dispatchEvent(new Event('resize'));
  expect(panel.style.left).toBe('20px'); expect(panel.style.top).toBe('80px');
});
