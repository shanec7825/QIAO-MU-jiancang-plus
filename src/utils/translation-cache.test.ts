import { beforeEach, expect, it, vi } from 'vitest';
import { webcrypto } from 'node:crypto';
const state = vi.hoisted(() => ({data:{} as Record<string,any>}));
vi.mock('./browser-polyfill',()=>({default:{storage:{local:{get:async(key:string)=>({[key]:state.data[key]}),set:async(value:Record<string,any>)=>Object.assign(state.data,structuredClone(value))}}}}));
import { translationCacheKey, readTranslationCache, writeTranslationCache } from './translation-cache';
beforeEach(()=>{state.data={};vi.stubGlobal('crypto',webcrypto);});
it('shares a cache across timestamp and short YouTube URLs but invalidates changed captions or another video',async()=>{
 const key=await translationCacheKey('https://www.youtube.com/watch?v=abcdefghijk&t=42',['Hello'],['0:42']);
 expect(await translationCacheKey('https://youtu.be/abcdefghijk?si=share',['Hello'],['0:42'])).toBe(key);
 expect(await translationCacheKey('https://youtu.be/lmnopqrstuv',['Hello'],['0:42'])).not.toBe(key);
 expect(await translationCacheKey('https://youtu.be/abcdefghijk',['Changed'],['0:42'])).not.toBe(key);
 expect(await translationCacheKey('https://youtu.be/abcdefghijk',['Hello'],['0:43'])).not.toBe(key);
});
it('retains completed paragraphs for a later page instance and rejects invalid cache entries',async()=>{
 const key=(await translationCacheKey('https://example.com/video',['Hello','Bye'],['0:00','0:10']))!;
 await writeTranslationCache(key,new Map([[0,'你好']]));
 expect(await readTranslationCache(key)).toEqual([[0,'你好']]);
 state.data[key].entries.push([0,'重复'],[-1,'无效'],[1,{}],[2,'再见']);
 expect(await readTranslationCache(key)).toEqual([[0,'你好'],[2,'再见']]);
});
