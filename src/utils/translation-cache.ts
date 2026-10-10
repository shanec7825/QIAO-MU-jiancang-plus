import browser from './browser-polyfill';
import { videoKey, audioKey } from './video-source';
import { normalizeUrl } from './url-utils';

export const TRANSLATION_CACHE_PREFIX = 'qiaomuTranslation1:';
// Include the exact transcript and timestamps: changed captions must never receive stale translations.
export async function translationCacheKey(url: string, texts: string[], timestamps: string[]): Promise<string | null> {
  if (!url) return null;
  const signature = JSON.stringify([videoKey(url) || audioKey(url) || normalizeUrl(url), texts, timestamps, 'zh-Hans', 1]);
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(signature));
  return TRANSLATION_CACHE_PREFIX + Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join('');
}
export async function readTranslationCache(key: string | null): Promise<Array<[number, string]>> {
  if (!key) return [];
  const value = (await browser.storage.local.get(key))[key] as {version?:unknown;entries?:unknown} | undefined;
  if (value?.version !== 1 || !Array.isArray(value.entries)) return [];
  const seen = new Set<number>();
  return value.entries.filter((entry: unknown): entry is [number,string] => {
    if (!Array.isArray(entry) || entry.length !== 2 || !Number.isInteger(entry[0]) || entry[0] < 0 || typeof entry[1] !== 'string' || seen.has(entry[0])) return false;
    seen.add(entry[0]); return true;
  });
}
export async function writeTranslationCache(key: string | null, cache: Map<number,string>): Promise<void> {
  if (key && cache.size) await browser.storage.local.set({[key]:{version:1,entries:Array.from(cache.entries()),updatedAt:new Date().toISOString()}});
}
