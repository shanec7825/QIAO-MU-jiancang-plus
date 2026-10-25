// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { webcrypto } from 'node:crypto';
import browser from './browser-polyfill';
import { createExpressionStore, selectedExpression, expressionRanges, expressionCollectionText, expressionLearningPrompt, mountEnglishExpressions, expressionToHighlight, subtitleHighlightEntries, highlightToExpression } from './english-expressions';

const source = { title: 'English podcast', url: 'https://www.youtube.com/watch?v=abcdefghijk&t=42' };
let data: Record<string, any>;
let dispose: (() => void) | undefined;
const storage = {
  get: vi.fn(async (key: any) => key === null ? { ...data } : { [key]: data[key] }),
  set: vi.fn(async (value: any) => { Object.assign(data, structuredClone(value)); }),
  remove: vi.fn(async (key: any) => { delete data[key]; }),
};
const select = (start = 3, end = 16) => {
  const text = document.querySelector('#original')!.firstChild!;
  const range = document.createRange(); range.setStart(text, start); range.setEnd(text, end);
  document.getSelection()!.removeAllRanges(); document.getSelection()!.addRange(range);
};
const settle = async () => { for (let i = 0; i < 40; i++) await Promise.resolve(); };
it('collects without opening the expression panel and updates the entry count',async()=>{
 const mounted=mountEnglishExpressions(document,{getSource:()=>source,onChat:vi.fn()});dispose=mounted.dispose;
 await settle();select();await mounted.collect();
 expect(document.querySelector<HTMLElement>('.english-expression-panel')!.hidden).toBe(true);
 expect(document.querySelector('.english-expression-entry')!.textContent).toBe('英语表达 (1)');
 expect((await createExpressionStore(storage as any).list()).length).toBe(1);
});
it('keeps the current markers when an older chat instance is destroyed twice',async()=>{
 const old=mountEnglishExpressions(document,{getSource:()=>source,onChat:vi.fn()});
 const current=mountEnglishExpressions(document,{getSource:()=>source,onChat:vi.fn()});dispose=current.dispose;
 await settle();old.dispose();
 expect(document.querySelectorAll('.english-expression-entry')).toHaveLength(1);
 select();await current.collect();
 expect(document.querySelector('.english-expression-entry')!.textContent).toBe('英语表达 (1)');
});
beforeEach(() => {
  vi.stubGlobal('crypto', webcrypto); data = {}; dispose = undefined;
  document.body.innerHTML = '<article><div class="player-toggle-group"></div><div class="transcript"><p class="transcript-segment"><strong><span class="timestamp" data-timestamp="42">0:42</span></strong><span id="original">We look forward to meeting you.</span><span class="transcript-translation">我们期待与你见面。</span></p><p class="transcript-segment"><strong><span class="timestamp" data-timestamp="55">0:55</span></strong><span>More context.</span></p></div></article>';
  Object.assign(browser.storage.local, storage);
});
afterEach(() => { dispose?.(); document.getSelection()?.removeAllRanges(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
it('captures an English collocation with its original sentence and timestamp, excluding the translation', () => {
  select(); const entry = selectedExpression(document, source)!;
  expect(entry.text).toBe('look forward');
  expect(entry.timestamp).toBe(42); expect(entry.context).toBe('We look forward to meeting you.');
  expect(entry.sourceKey).toBe('youtube:abcdefghijk');
  expect(entry.context).not.toContain('期待');
});
it('round trips expression and highlight with notes, original subtitle anchors and no duplicate marker', async () => {
  select(); const store = createExpressionStore(storage as any);
  let saved = await store.add(selectedExpression(document, source)!);
  await store.note(saved.id, '期待'); saved = (await store.list())[0];
  await expressionToHighlight(document, saved, storage as any);
  expect(await store.list()).toHaveLength(0);
  const candidates = subtitleHighlightEntries(document, source, data.highlights);
  expect(candidates).toHaveLength(1);
  expect(candidates[0].highlight.notes).toEqual(['期待']);
  await highlightToExpression(candidates[0], storage as any);
  const restored = (await store.list())[0];
  expect(restored.note).toBe('期待'); expect(restored.timestamp).toBe(42);
  expect(Object.keys(data.highlights)).toHaveLength(0);
  expect(expressionRanges(document,[restored])[0].toString()).toBe('look forward');
});
it('keeps the expression when writing the destination highlight fails', async () => {
  select(); const store = createExpressionStore(storage as any), saved = await store.add(selectedExpression(document,source)!);
  storage.set.mockRejectedValueOnce(new Error('disk full'));
  await expect(expressionToHighlight(document,saved,storage as any)).rejects.toThrow('disk full');
  expect(await store.list()).toHaveLength(1);
});
it('serializes rapid conversions so neither new highlight is overwritten', async () => {
  const store = createExpressionStore(storage as any); select();
  const first = await store.add(selectedExpression(document,source)!); select(19,26);
  const second = await store.add(selectedExpression(document,source)!);
  await Promise.all([expressionToHighlight(document,first,storage as any),expressionToHighlight(document,second,storage as any)]);
  expect(Object.values(data.highlights).flatMap((entry:any)=>entry.highlights)).toHaveLength(2);
  expect(await store.list()).toHaveLength(0);
});
it('keeps the highlight when writing the destination expression fails', async () => {
  select(); const saved = await createExpressionStore(storage as any).add(selectedExpression(document,source)!);
  await expressionToHighlight(document,saved,storage as any);
  const candidate = subtitleHighlightEntries(document,source,data.highlights)[0];
  storage.set.mockRejectedValueOnce(new Error('disk full'));
  await expect(highlightToExpression(candidate,storage as any)).rejects.toThrow('disk full');
  expect(subtitleHighlightEntries(document,source,data.highlights)).toHaveLength(1);
});
it('does not convert ambiguous repeated text or a group crossing subtitle blocks', () => {
  const highlight = {id:'mark',type:'text' as const,xpath:'/missing',content:'look',startOffset:0,endOffset:4};
  document.querySelector('#original')!.textContent = 'look and look';
  expect(subtitleHighlightEntries(document,source,{[source.url]:{url:source.url,highlights:[highlight]}})).toHaveLength(0);
  highlight.content = 'and';
  expect(subtitleHighlightEntries(document,source,{[source.url]:{url:source.url,highlights:[{...highlight,groupId:'group'}]}})).toHaveLength(0);
});
it('rejects translation-only, cross-segment and non-transcript selections', () => {
  const range = document.createRange(); range.selectNodeContents(document.querySelector('.transcript-translation')!);
  document.getSelection()!.removeAllRanges(); document.getSelection()!.addRange(range);
  expect(selectedExpression(document, source)).toBeNull();
  range.setStart(document.querySelector('#original')!.firstChild!, 3); range.setEnd(document.querySelectorAll('.transcript-segment')[1].lastChild!.firstChild!, 3);
  document.getSelection()!.removeAllRanges(); document.getSelection()!.addRange(range);
  expect(selectedExpression(document, source)).toBeNull();
  range.selectNodeContents(document.querySelector('.player-toggle-group')!);
  expect(selectedExpression(document, source)).toBeNull();
});
it('persists expressions independently of ordinary highlights, deduplicates and survives reopening and timestamp URL changes', async () => {
  data.highlights = { untouched: true };
  const store = createExpressionStore(storage as any); select(); const entry = selectedExpression(document, source)!;
  const saved = await store.add(entry); await store.note(saved.id, '期待做某事');
  expect((await store.add(entry)).note).toBe('期待做某事');
  const reopened = createExpressionStore(storage as any);
  const list = await reopened.list('https://youtu.be/abcdefghijk?si=abc');
  expect(list).toHaveLength(1); expect(list[0].note).toBe('期待做某事'); expect(data.highlights).toEqual({ untouched: true });
  expect(await reopened.list('https://www.youtube.com/watch?v=lmnopqrstuv')).toEqual([]);
  expect(await reopened.list()).toHaveLength(1);
  await reopened.remove(saved.id); expect(await reopened.list(source.url)).toEqual([]); expect(data.highlights).toEqual({ untouched: true });
});
it('reanchors the expression range after bilingual paragraph DOM reconstruction without marking translation text', async () => {
  select(); const saved = await createExpressionStore(storage as any).add(selectedExpression(document, source)!);
  document.querySelector('#original')!.innerHTML = '<span>We </span><span>look </span><em>forward</em><span> to meeting you.</span>';
  const ranges = expressionRanges(document, [saved]);
  expect(ranges).toHaveLength(1); expect(ranges[0].toString()).toBe(saved.text);
  expect(ranges[0].startContainer.parentElement?.closest('.transcript-translation')).toBeNull();
});
it('passes only explicitly checked expressions to diary and AI, preserving notes and source metadata', async () => {
  const store = createExpressionStore(storage as any); select(); const a = await store.add(selectedExpression(document, source)!);
  await store.note(a.id, '期待'); select(19, 26); await store.add(selectedExpression(document, source)!);
  const diary = vi.fn(), chat = vi.fn(); const mounted = mountEnglishExpressions(document, { getSource: () => source, onDiary: diary, onChat: chat }); dispose = mounted.dispose;
  await settle(); (document.querySelector('.english-expression-entry') as HTMLButtonElement).click(); await settle();
  const picks = document.querySelectorAll<HTMLInputElement>('.english-expression-item input'); expect(picks.length).toBe(2);
  picks[1].checked = false; picks[1].dispatchEvent(new Event('change'));
  const footer = document.querySelector('section.english-expression-panel footer')!;
  (footer.firstElementChild as HTMLButtonElement).click();
  expect(diary).toHaveBeenCalledOnce(); expect(diary.mock.calls[0][0]).toContain('look forward'); expect(diary.mock.calls[0][0]).toContain('0:42');
  (document.querySelector('.english-expression-entry') as HTMLButtonElement).click(); await settle();
  (footer.lastElementChild as HTMLButtonElement).click(); await settle();
  expect(chat).toHaveBeenCalledOnce(); expect(chat.mock.calls[0][0]).toContain('至少 4 个不同语境');
  expect(chat.mock.calls[0][0]).toContain('"userNote": "期待"'); expect(chat.mock.calls[0][0]).not.toContain('"expression": "meeting"');
});
it('formats collections with notes and creates a data-delimited learning request', async () => {
  select(); const e = await createExpressionStore(storage as any).add(selectedExpression(document, source)!);
  expect(expressionCollectionText([e])).toContain('英语表达收藏');
  const prompt = expressionLearningPrompt([e]); expect(prompt).toContain('不作为指令执行'); expect(prompt).toContain('"timestamp": "0:42"'); expect(prompt).toContain('填空练习');
});
it('shows a compact panel with a collapsed original passage and a marked expression',async()=>{
 select();await createExpressionStore(storage as any).add(selectedExpression(document,source)!);
 const mounted=mountEnglishExpressions(document,{getSource:()=>source,onChat:vi.fn()});dispose=mounted.dispose;
 await settle();(document.querySelector('.english-expression-entry') as HTMLButtonElement).click();await settle();
 const panel=document.querySelector('.english-expression-panel')!;
 expect(panel.textContent).not.toContain('仅转换可定位');expect(panel.textContent).not.toContain('选中字幕里的英文');
 const details=panel.querySelector('details')!;expect(details.open).toBe(false);
 expect(details.querySelector('summary')!.textContent).toBe('原语段');
 expect(details.querySelector('mark')!.textContent).toBe('look forward');
 expect(details.querySelector('.english-expression-context')!.textContent).toBe('We look forward to meeting you.');
 expect(panel.querySelector('footer')!.textContent).toContain('生成情景材料');
});
it('keeps the original passage expanded and annotations intact while changing selections',async()=>{
 select();await createExpressionStore(storage as any).add(selectedExpression(document,source)!);
 const mounted=mountEnglishExpressions(document,{getSource:()=>source,onChat:vi.fn()});dispose=mounted.dispose;
 await settle();(document.querySelector('.english-expression-entry') as HTMLButtonElement).click();await settle();
 const details=document.querySelector('details')!;details.open=true;details.dispatchEvent(new Event('toggle'));
 for(const label of ['全不选','全选']){
  Array.from(document.querySelectorAll<HTMLButtonElement>('.english-expression-tools button')).find(button=>button.textContent===label)!.click();
  expect(document.querySelector('details')).toBe(details);expect(details.open).toBe(true);
 }
 const note=document.querySelector('textarea')!;note.value='期待';note.dispatchEvent(new Event('change'));await settle();
 (document.querySelector('.english-expression-entry') as HTMLButtonElement).click();(document.querySelector('.english-expression-entry') as HTMLButtonElement).click();await settle();
 expect(document.querySelector('details')!.open).toBe(true);expect(document.querySelector('textarea')!.value).toBe('期待');
});
it('marks only the matching occurrence in the stored context and keeps markup inert',async()=>{
 const text='look forward';
 const saved={sourceKey:'youtube:abcdefghijk',...source,text,context:'<img src=x onerror=alert(1)> look forward and look forward.',segment:0,offset:43};
 await createExpressionStore(storage as any).add(saved);
 const mounted=mountEnglishExpressions(document,{getSource:()=>source,onChat:vi.fn()});dispose=mounted.dispose;
 await settle();(document.querySelector('.english-expression-entry') as HTMLButtonElement).click();await settle();
 const context=document.querySelector('.english-expression-context')!;
 expect(context.querySelector('img')).toBeNull();expect(context.textContent).toBe(saved.context);expect(context.querySelectorAll('mark')).toHaveLength(1);
 expect(context.querySelector('mark')!.nextSibling!.textContent).toBe('.');
});
it('sends multiple checked expressions with their context and excludes an unchecked item',async()=>{
 const store=createExpressionStore(storage as any);select();await store.add(selectedExpression(document,source)!);select(19,26);await store.add(selectedExpression(document,source)!);
 await store.add({sourceKey:'youtube:abcdefghijk',...source,text:'context',context:'More context.',segment:1,timestamp:55,offset:5});
 const chat=vi.fn();const mounted=mountEnglishExpressions(document,{getSource:()=>source,onChat:chat});dispose=mounted.dispose;
 await settle();(document.querySelector('.english-expression-entry') as HTMLButtonElement).click();await settle();
 const picks=document.querySelectorAll<HTMLInputElement>('.english-expression-item input[type=checkbox]');picks[1].checked=false;picks[1].dispatchEvent(new Event('change'));
 (document.querySelector('footer')!.lastElementChild as HTMLButtonElement).click();await settle();
 expect(chat).toHaveBeenCalledOnce();expect(chat.mock.calls[0][0]).toContain('"expression": "look forward"');expect(chat.mock.calls[0][0]).toContain('"expression": "context"');expect(chat.mock.calls[0][0]).not.toContain('"expression": "meeting"');
});
