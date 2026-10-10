import DOMPurify from 'dompurify';
import { marked } from 'marked';

const escape = (text: string) => text.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]!));
export function chatLearningHtml(markdown: string, title: string): string {
  const content = DOMPurify.sanitize(marked.parse(markdown, { gfm: true, async: false }) as string, {
    FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form', 'input', 'button', 'img', 'video', 'audio', 'link', 'meta', 'svg'],
    FORBID_ATTR: ['style', 'src', 'srcset', 'id', 'name'],
  });
  return `<!doctype html>\n<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'"><title>${escape(title)}</title><style>body{max-width:850px;margin:40px auto;padding:0 24px;font:17px/1.8 system-ui,sans-serif;color:#1c2730;background:#fff}h1,h2,h3{line-height:1.3;color:#075e65}table{border-collapse:collapse;width:100%;display:block;overflow:auto}th,td{border:1px solid #ddd;padding:8px 12px}pre{white-space:pre-wrap;background:#f4f6f7;padding:16px}blockquote{border-left:3px solid #16888d;margin-left:0;padding-left:16px}a{color:#087078}code{overflow-wrap:anywhere}@media(prefers-color-scheme:dark){body{background:#172126;color:#e4ecef}h1,h2,h3,a{color:#82d3d3}pre{background:#223139}}</style></head><body>${content}</body></html>`;
}
export function downloadChatAnswer(answer: string, title: string, format: 'md' | 'html', doc = document): void {
  const name = (title || '英语表达学习').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '-').slice(0, 70);
  const blob = new Blob([format === 'html' ? chatLearningHtml(answer, title) : answer], { type: format === 'html' ? 'text/html;charset=utf-8' : 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob), link = doc.createElement('a');
  link.href = url; link.download = `${name}.${format}`; doc.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
