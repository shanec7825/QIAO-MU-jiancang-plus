import browser from './browser-polyfill';
import { snapshotConversation, type Conversation } from './chat-history';
import { exportHistoryRecords, importHistoryRecords } from './chat-history-store';
import { legacyPage } from './chat-history-legacy';
import { chatPageKey, type ChatSource } from './chat-source';
import { pickLocalBackup, restoreLocalBackup, type LocalBackup } from './local-backup';

const HISTORY_KEY = 'qiaomuChatHistory1';
// Settings JSON carries history and media references. Image payloads remain in
// their existing browser media stores; this is not a portable image archive.
function record(value: unknown, source: ChatSource): Conversation {
 const chat = value as Conversation | null;
 if (!chat || typeof chat.id !== 'string' || !chat.id || typeof chat.title !== 'string' || !Array.isArray(chat.messages)
  || chat.messages.some(turn => !turn || !['user','assistant'].includes(turn.role) || typeof turn.content !== 'string')
  || typeof source.url !== 'string' || !source.url || typeof source.title !== 'string') throw new Error('聊天记录备份格式无效');
 return snapshotConversation(chat, source, Number.isFinite(chat.updatedAt) ? chat.updatedAt : 0);
}
function recordsFrom(local: Record<string, unknown>): Conversation[] {
 const records: Conversation[] = [];
 for (const [key, raw] of Object.entries(local)) {
  if (key === HISTORY_KEY) {
   const backup = raw as {version?: unknown; conversations?: unknown[]} | null;
   if (backup?.version !== 1 || !Array.isArray(backup.conversations)) throw new Error('聊天记录备份版本无效');
   for (const value of backup.conversations) records.push(record(value, (value as Conversation)?.source ?? {url:'',title:''}));
  } else if (key.startsWith('qiaomuChat:')) {
   const page = raw as {url?: string; title?: string; conversations?: unknown[]} | null;
   const pageKey = page && legacyPage(key, page);
   if (!pageKey || !Array.isArray(page?.conversations)) throw new Error('旧聊天记录备份格式无效');
   const source = {url:page.url!,title:typeof page.title === 'string' ? page.title : page.url!,preserveUrlHash:pageKey !== chatPageKey(page.url!)};
   for (const value of page.conversations) records.push(record(value, source));
  }
 }
 return Array.from(new Map(records.map(chat => [JSON.stringify([chatPageKey(chat.source!.url, chat.source!.preserveUrlHash),chat.id]),chat])).values());
}
export async function exportLocalData(): Promise<LocalBackup> {
 // Finish any legacy migration first, then capture the current settings keys.
 const conversations = await exportHistoryRecords();
 return pickLocalBackup({...await browser.storage.local.get(null),[HISTORY_KEY]:{version:1,conversations}});
}
export async function restoreLocalData(store: {set(items:Record<string,unknown>):Promise<void>}, local:Record<string,unknown>):Promise<number> {
 const records = recordsFrom(local);
 if (records.length) await importHistoryRecords(records);
 const settings = Object.fromEntries(Object.entries(local).filter(([key]) => key !== HISTORY_KEY && !key.startsWith('qiaomuChat:') && key !== 'qiaomuChatIndex'));
 await restoreLocalBackup(store,settings);
 return Object.keys(local).length;
}
