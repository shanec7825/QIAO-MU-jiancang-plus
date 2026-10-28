import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { webcrypto } from 'node:crypto';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ data: {} as Record<string, unknown>, set: vi.fn() }));
vi.mock('./browser-polyfill', () => ({ default: { storage: { local: {
 get: async (key: string | null) => key === null ? { ...state.data } : { [key]: state.data[key] },
 set: async (values: Record<string, unknown>) => { Object.assign(state.data, structuredClone(values)); state.set(values); },
 remove: async (keys: string | string[]) => { for (const key of Array.isArray(keys) ? keys : [keys]) delete state.data[key]; },
} } } }));
import browser from './browser-polyfill';
import { exportLocalData, restoreLocalData } from './local-backup-history';
import { chatKey, saveConversation, loadConversations, listChatHistory, readConversation, clearChatHistory, type Conversation } from './chat-history';
const url = 'https://example.test/podcast';
const chat = (): Conversation => ({ id: 'kept', title: 'Question', updatedAt: 42, messages: [{ role: 'user', content: 'Question', bookmarked: true, quote: 'look forward to' }, { role: 'assistant', content: 'Answer', thought: 'Reasoning' }] });
beforeEach(() => { state.data = {}; state.set.mockClear(); vi.stubGlobal('indexedDB', new IDBFactory()); vi.stubGlobal('crypto', webcrypto); });
afterEach(() => vi.unstubAllGlobals());

it('exports migrated chat history with the existing local expressions and translation cache', async () => {
 state.data['qiaomuEnglishExpression1:abc'] = { text: 'look forward to' };
 state.data['qiaomuTranslation1:abc'] = { version: 1, entries: [[0, '期待']] };
 state.data.qiaomuDeviceId = 'do not export';
 await saveConversation(url, 'Podcast', chat());
 const backup = await exportLocalData();
 const history = backup.items.qiaomuChatHistory1 as { version: number; conversations: Conversation[] };
 expect(history.version).toBe(1); expect(history.conversations).toHaveLength(1);
 expect(history.conversations[0].messages[0].bookmarked).toBe(true); expect(history.conversations[0].messages[1].thought).toBe('Reasoning');
 expect(backup.items['qiaomuEnglishExpression1:abc']).toBeDefined(); expect(backup.items['qiaomuTranslation1:abc']).toBeDefined();
 expect(backup.items.qiaomuDeviceId).toBeUndefined();
});
it('restores an older settings file even after the one-time database migration has finished', async () => {
 await listChatHistory();
 const oldUrl = url + '#/lesson', key = chatKey(oldUrl, true);
 await restoreLocalData(browser.storage.local, { [key]: { url: oldUrl, title: 'Old page', conversations: [chat()] }, qiaomuChatIndex: [{ key }], highlights: { kept: true } });
 expect(await loadConversations(oldUrl, true)).toHaveLength(1); expect(await loadConversations(url + '#/other', true)).toHaveLength(0);
 expect(state.data.highlights).toEqual({ kept: true }); expect(state.data[key]).toBeUndefined(); expect(state.data.qiaomuChatIndex).toBeUndefined();
});
it('restores an explicit backup after deletion and preserves other chats without duplicates', async () => {
 await saveConversation(url, 'Podcast', chat()); const backup = await exportLocalData(); await clearChatHistory();
 await saveConversation('https://another.test/', 'Unrelated', { ...chat(), id: 'unrelated' });
 await restoreLocalData(browser.storage.local, backup.items); await restoreLocalData(browser.storage.local, backup.items);
 expect((await listChatHistory()).items).toHaveLength(2);
 expect((await readConversation(url, 'kept'))!.messages[0].bookmarked).toBe(true);
});
it('keeps the restored revision safe from stale windows', async () => {
 await saveConversation(url, 'Podcast', chat()); const stale = (await readConversation(url, 'kept'))!;
 const backup = await exportLocalData(); await restoreLocalData(browser.storage.local, backup.items);
 stale.messages.push({ role: 'user', content: 'stale update' });
 await expect(saveConversation(url, 'Podcast', stale)).rejects.toThrow();
 expect((await readConversation(url, 'kept'))!.messages).toHaveLength(2);
});
it('rejects malformed backup history before writing settings or conversations', async () => {
 await expect(restoreLocalData(browser.storage.local, { highlights: {}, qiaomuChatHistory1: { version: 1, conversations: [{ ...chat(), source: {url,title:'Page'}, messages: [{role:'system',content:'bad'}] }] } })).rejects.toThrow('备份格式无效');
 expect(state.set).not.toHaveBeenCalled(); expect((await listChatHistory()).items).toHaveLength(0);
});
it('surfaces a database failure without dropping history into obsolete storage keys', async () => {
 vi.stubGlobal('indexedDB', {open() {throw new Error('Disk full');}});
 await expect(restoreLocalData(browser.storage.local, { [chatKey(url)]: {url,title:'Page',conversations:[chat()]}, highlights:{} })).rejects.toThrow('Disk full');
 expect(state.set).not.toHaveBeenCalled();
});
