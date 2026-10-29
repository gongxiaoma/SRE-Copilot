import MarkdownIt from 'markdown-it'
import DOMPurify from 'dompurify'
import hljs from 'highlight.js/lib/core'
import javascript from 'highlight.js/lib/languages/javascript'
import typescript from 'highlight.js/lib/languages/typescript'
import json from 'highlight.js/lib/languages/json'
import bash from 'highlight.js/lib/languages/bash'
import yaml from 'highlight.js/lib/languages/yaml'
import python from 'highlight.js/lib/languages/python'
import sql from 'highlight.js/lib/languages/sql'
import xml from 'highlight.js/lib/languages/xml'
import css from 'highlight.js/lib/languages/css'
import dockerfile from 'highlight.js/lib/languages/dockerfile'

for (const [name, language] of Object.entries({ javascript, typescript, json, bash, yaml, python, sql, xml, css, dockerfile })) hljs.registerLanguage(name, language)
const md = new MarkdownIt({ html: false, linkify: true, breaks: true })
md.renderer.rules.fence = (tokens, index) => {
  const token = tokens[index]!
  const language = token.info.trim().split(/\s+/)[0] || 'text'
  const code = token.content
  const highlighted = code.length < 100_000 && hljs.getLanguage(language)
    ? hljs.highlight(code, { language, ignoreIllegals: true }).value
    : md.utils.escapeHtml(code)
  return `<div class="code-block"><div class="code-toolbar"><span>${md.utils.escapeHtml(language)}</span><button type="button" class="copy-code" aria-label="复制代码">复制代码</button></div><pre><code class="hljs">${highlighted}</code></pre></div>`
}
// 运维内容可能含外链；不自动请求远程图片，避免跟踪和无意网络访问。
md.renderer.rules.image = (tokens, index) => `<span class="image-placeholder">[图片：${md.utils.escapeHtml(tokens[index]!.content)}]</span>`

/** v-html 的唯一入口：禁用原始 HTML，并对最终高亮结果再次净化。 */
export function renderMarkdown(source: string): string {
  return DOMPurify.sanitize(md.render(source), {
    USE_PROFILES: { html: true }, ADD_TAGS: ['button'], ADD_ATTR: ['type', 'aria-label'],
    FORBID_TAGS: ['img', 'style', 'form', 'input', 'iframe'],
  })
}
