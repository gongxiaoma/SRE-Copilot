// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { renderMarkdown } from '../src/utils/markdown'
describe('Markdown 安全渲染', () => {
  it('支持表格、高亮和复制按钮', () => {
    const html = renderMarkdown('| 列 |\n| --- |\n| 值 |\n\n```js\nconst a = 1\n```')
    expect(html).toContain('<table>')
    expect(html).toContain('hljs-keyword')
    expect(html).toContain('copy-code')
  })
  it('禁止 HTML 执行、脚本链接和 SVG 注入', () => {
    const div = document.createElement('div')
    div.innerHTML = renderMarkdown('<img src=x onerror=alert(1)><script>alert(1)</script>\n[x](javascript:alert(1))\n<svg onload=alert(1)>')
    expect(div.querySelector('script,img,svg,[onerror],[onload],a[href^="javascript:"]')).toBeNull()
  })
})
