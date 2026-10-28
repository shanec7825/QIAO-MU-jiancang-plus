// @vitest-environment jsdom
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
vi.mock('./i18n',()=>({getMessage:(key:string)=>key}));
import {wireTranscript,unwireTranscript} from './reader-transcript';
let article:HTMLElement;
beforeEach(()=>{vi.useFakeTimers();vi.stubGlobal('CSS',{});document.getSelection()?.removeAllRanges();});
afterEach(()=>{if(article)unwireTranscript(article);document.getSelection()?.removeAllRanges();vi.useRealTimers();vi.unstubAllGlobals();});
function setup(kind:'youtube'|'native'|'bilibili'='youtube') {
 document.body.innerHTML=`<article>${kind==='native'?'<div class="reader-video-wrapper"><video class="reader-video-player"></video></div>':`<iframe src="${kind==='bilibili'?'https://player.bilibili.com/player.html?bvid=BV1cSec6tEux':'https://www.youtube.com/embed/abcdefghijk?enablejsapi=1'}"></iframe>`}<div class="transcript youtube"><p class="transcript-segment"><strong><span class="timestamp" data-timestamp="0">0:00</span></strong>First passage.</p><p class="transcript-segment"><strong><span class="timestamp" data-timestamp="30">0:30</span></strong>Second passage.</p></div></article>`;
 article=document.querySelector('article')!;const scroll=vi.fn();let paused=true;
 const video=article.querySelector('video');if(video)Object.defineProperty(video,'paused',{get:()=>paused});
 wireTranscript(document,article,{pinPlayer:false,autoScroll:true,highlightActiveLine:false},{getStickyOffset:()=>0,scrollTo:scroll,programmaticScroll:()=>false});
 const report=(time:number,playing:boolean)=>{
  if(video){paused=!playing;video.currentTime=time;video.dispatchEvent(new Event(playing?'play':'pause'));video.dispatchEvent(new Event('timeupdate'));}
  else {const frame=article.querySelector('iframe')!;window.dispatchEvent(new MessageEvent('message',{source:frame.contentWindow,data:kind==='bilibili'?{qiaomuPlayer:'time',time,paused:!playing}:{info:{currentTime:time,playerState:playing?1:2}}}));}
 };
 return {scroll,report};
}
it('does not return to the playing line after ten seconds when YouTube is paused',()=>{
 const {scroll,report}=setup();report(1,true);expect(scroll).toHaveBeenCalledOnce();scroll.mockClear();
 window.dispatchEvent(new Event('scroll'));report(1,false);vi.advanceTimersByTime(11000);
 expect(scroll).not.toHaveBeenCalled();
});
it('processes a pause before a new timestamp in the same YouTube message',()=>{
 const {scroll,report}=setup();report(1,true);scroll.mockClear();report(31,false);
 expect(article.querySelector('.is-active')?.textContent).toContain('Second passage');expect(scroll).not.toHaveBeenCalled();
});
it('follows trusted embedded playback even without the YouTube API and holds position on pause',()=>{
 const {scroll}=setup();const frame=article.querySelector('iframe')!;
 const report=(time:number,paused:boolean,origin='https://www.youtube.com')=>window.dispatchEvent(new MessageEvent('message',{source:frame.contentWindow,origin,data:{qiaomuPlayer:'time',time,paused}}));
 report(1,false,'https://evil.example');expect(scroll).not.toHaveBeenCalled();report(1,false);expect(scroll).toHaveBeenCalledOnce();scroll.mockClear();report(31,true);
 expect(article.querySelector('.is-active')?.textContent).toContain('Second passage');expect(scroll).not.toHaveBeenCalled();
});
it.each(['native','bilibili'] as const)('does not follow paused %s playback after manual scrolling or seeking',kind=>{
 const {scroll,report}=setup(kind);report(1,true);scroll.mockClear();window.dispatchEvent(new Event('scroll'));report(1,false);
 vi.advanceTimersByTime(11000);report(31,false);expect(scroll).not.toHaveBeenCalled();
});
it('holds position while selecting even when playback continues, and resumes following after the selection clears',()=>{
 const {scroll,report}=setup();report(1,true);scroll.mockClear();
 const text=article.querySelector('.transcript-segment-text')!.firstChild!;const range=document.createRange();range.setStart(text,0);range.setEnd(text,5);document.getSelection()!.addRange(range);
 window.dispatchEvent(new Event('scroll'));vi.advanceTimersByTime(11000);report(31,true);expect(scroll).not.toHaveBeenCalled();
 document.getSelection()!.removeAllRanges();report(1,true);expect(scroll).toHaveBeenCalledOnce();
});
it('does not move at the start of a selection gesture before the range is populated',()=>{
 const {scroll,report}=setup();report(1,true);scroll.mockClear();
 article.querySelector('.transcript-segment-text')!.dispatchEvent(new MouseEvent('pointerdown',{bubbles:true,button:0}));report(31,true);expect(scroll).not.toHaveBeenCalled();
 window.dispatchEvent(new MouseEvent('pointerup'));report(1,true);expect(scroll).toHaveBeenCalledOnce();
});
