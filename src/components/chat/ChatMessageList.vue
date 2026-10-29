<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import { ElButton } from 'element-plus'
import ChatMessage from './ChatMessage.vue'
import type { Conversation } from '../../types/chat'
const props = defineProps<{ conversation: Conversation; busy: boolean }>()
defineEmits<{ regenerate: []; suggestion: [text: string] }>()
const container = ref<HTMLElement>()
const pinned = ref(true)
function onScroll() {
  const el = container.value
  if (el) pinned.value = el.scrollHeight - el.scrollTop - el.clientHeight < 100
}
async function bottom() { await nextTick(); const el = container.value; if (el) el.scrollTop = el.scrollHeight; pinned.value = true }
watch(() => props.conversation.id, () => { void bottom() })
watch(() => props.conversation.turns.length, () => { void bottom() })
watch(() => {
  const turn = props.conversation.turns.at(-1)
  return [turn?.answer, turn?.stages.length, turn?.status, turn?.progress, turn?.error]
}, async () => { if (pinned.value) await bottom() }, { flush: 'post' })
</script>

<template>
  <div class="message-region">
    <div ref="container" class="message-scroll" @scroll="onScroll">
      <div v-if="!conversation.turns.length" class="welcome">
        <div class="welcome-symbol">H</div><p class="eyebrow">HOLMESGPT · AI 运维助手</p><h1>今天有什么需要排查？</h1><p class="welcome-description">描述问题，结合上下文一起分析、定位和解决。</p>
        <div class="suggestions"><button v-for="text in ['如何排查 Pod 反复重启？', '帮我分析一段错误日志', '服务延迟升高，应该从哪里检查？']" :key="text" @click="$emit('suggestion', text)">{{ text }} <span>↗</span></button></div>
      </div>
      <div v-else class="message-content" aria-label="对话消息"><ChatMessage v-for="(turn, index) in conversation.turns" :key="turn.id" :turn="turn" :last="index === conversation.turns.length - 1" :busy="busy" @regenerate="$emit('regenerate')" /></div>
    </div>
    <ElButton v-if="!pinned" class="scroll-bottom" round @click="bottom">↓ 回到最新消息</ElButton>
  </div>
</template>
