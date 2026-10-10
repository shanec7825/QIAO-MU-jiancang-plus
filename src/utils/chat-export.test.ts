// @vitest-environment jsdom
import { expect, it } from 'vitest';
import { chatLearningHtml } from './chat-export';

it('exports a readable standalone HTML learning document with no active or remotely loaded model content', () => {
  const html = chatLearningHtml('# look forward to\n\n|English|中文|\n|---|---|\n|I look forward to it.|我很期待。|\n\n<script>alert(1)</script><img src="https://tracking.invalid/pixel"><iframe src="https://bad.invalid"></iframe><a href="javascript:alert(1)">bad</a>', '<script>title</script>');
  const doc = new DOMParser().parseFromString(html, 'text/html');
  expect(doc.title).toBe('<script>title</script>'); expect(doc.querySelector('table')).not.toBeNull(); expect(doc.body.textContent).toContain('我很期待');
  expect(doc.body.querySelector('script,img,iframe')).toBeNull();
  expect(doc.querySelector('a')?.getAttribute('href')).toBeNull();
  expect(doc.querySelector('[http-equiv="Content-Security-Policy"]')?.getAttribute('content')).toContain("default-src 'none'");
});
