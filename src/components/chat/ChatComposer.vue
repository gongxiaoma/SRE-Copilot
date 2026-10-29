<script setup lang="ts">
import { ElButton, ElInput } from 'element-plus'
defineProps<{ modelValue: string; busy: boolean; blocked: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [value: string]; send: []; stop: [] }>()
function keydown(event: Event | KeyboardEvent) {
  if (!(event instanceof KeyboardEvent)) return
  if (event.key === 'Enter' && !event.shiftKey && !event.isComposing && event.keyCode !== 229) {
    event.preventDefault()
    emit('send')
  }
}
</script>

<template>
  <footer class="composer-area">
    <p v-if="blocked && !busy" class="composer-warning">上一轮未完成，请先重试、重新生成或清空对话。</p>
    <form class="composer" @submit.prevent="$emit('send')">
      <label class="sr-only" for="chat-prompt">输入运维问题</label>
      <ElInput id="chat-prompt" :model-value="modelValue" type="textarea" :autosize="{ minRows: 1, maxRows: 7 }" :maxlength="32000" resize="none" placeholder="向 HolmesGPT 提问…" @update:model-value="$emit('update:modelValue', $event)" @keydown="keydown" />
      <div class="composer-tools"><span>Enter 发送 · Shift + Enter 换行</span><ElButton v-if="busy" class="stop-button" @click="$emit('stop')">■ 停止生成</ElButton><ElButton v-else type="primary" native-type="submit" :disabled="!modelValue.trim() || blocked" aria-label="发送消息">发送 ↑</ElButton></div>
    </form>
    <p class="composer-hint">AI 回复仅供参考，请核实操作影响后执行。实际输出速度取决于服务端。</p>
  </footer>
</template>
