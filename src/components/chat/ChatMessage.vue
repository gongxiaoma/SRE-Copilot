<script setup lang="ts">
import { ElAlert, ElButton, ElMessage } from 'element-plus'
import MarkdownContent from './MarkdownContent.vue'
import type { ChatTurn } from '../../types/chat'
defineProps<{ turn: ChatTurn; last: boolean; busy: boolean }>()
defineEmits<{ regenerate: [] }>()
async function copyAnswer(text: string) {
  try { await navigator.clipboard.writeText(text); ElMessage.success('回复已复制') }
  catch { ElMessage.error('无法复制，请检查浏览器剪贴板权限') }
}
</script>

<template>
  <div class="turn">
    <article class="message user-message"><div class="avatar user-avatar">你</div><div class="message-main"><div class="message-name">你</div><div class="user-text">{{ turn.ask }}</div></div></article>
    <article class="message assistant-message" :aria-busy="turn.status === 'connecting' || turn.status === 'streaming'">
      <div class="avatar assistant-avatar">H</div>
      <div class="message-main">
        <div class="message-name">HolmesGPT <span>运维助手</span></div>
        <details v-if="turn.stages.length" class="stages" :open="!turn.answer"><summary>分析过程 · {{ turn.stages.length }} 条阶段消息</summary><MarkdownContent v-for="(stage, index) in turn.stages" :key="index" :content="stage" /></details>
        <MarkdownContent v-if="turn.answer" :content="turn.answer" />
        <div v-if="turn.status === 'connecting' || turn.status === 'streaming'" class="generating" role="status"><span class="loading-dots"><i /><i /><i /></span>{{ turn.progress || '正在分析问题' }}</div>
        <ElAlert v-if="turn.error" class="turn-error" :title="turn.error" type="error" :closable="false" show-icon />
        <p v-if="turn.status === 'stopped'" class="muted">已停止生成，可重新生成本轮回复。</p>
        <div v-if="!busy" class="message-actions"><ElButton v-if="turn.answer" text size="small" @click="copyAnswer(turn.answer)">复制回复</ElButton><ElButton v-if="last" text size="small" @click="$emit('regenerate')">{{ turn.status === 'error' ? '重试' : '重新生成' }}</ElButton></div>
      </div>
    </article>
  </div>
</template>
