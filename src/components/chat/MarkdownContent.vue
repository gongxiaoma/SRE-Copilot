<script setup lang="ts">
import { computed } from 'vue'
import { ElMessage } from 'element-plus'
import { renderMarkdown } from '../../utils/markdown'
const props = defineProps<{ content: string }>()
const html = computed(() => renderMarkdown(props.content))
async function copyCode(event: MouseEvent) {
  const target = event.target
  if (!(target instanceof Element)) return
  const button = target.closest<HTMLButtonElement>('button.copy-code')
  if (!button) return
  const code = button.closest('.code-block')?.querySelector('code')?.textContent
  if (code === undefined || code === null) return
  try { await navigator.clipboard.writeText(code); ElMessage.success('代码已复制') }
  catch { ElMessage.error('复制失败，请在 HTTPS 或 localhost 下使用，或手动选择代码') }
}
</script>

<template>
  <!-- html 只能来自统一的 DOMPurify 净化入口。 -->
  <div class="markdown" @click="copyCode" v-html="html" />
</template>
