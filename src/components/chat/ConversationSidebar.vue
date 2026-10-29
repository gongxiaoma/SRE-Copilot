<script setup lang="ts">
import { ElButton } from 'element-plus'
import type { Conversation } from '../../types/chat'
defineProps<{ conversations: Conversation[]; activeId: string; open: boolean }>()
defineEmits<{ create: []; select: [id: string]; remove: [id: string]; close: [] }>()
</script>

<template>
  <button v-if="open" class="sidebar-scrim" aria-label="关闭会话栏" @click="$emit('close')" />
  <aside class="sidebar" :class="{ open }" aria-label="会话列表">
    <div class="brand"><span class="brand-icon">H</span><div>HolmesGPT<small>AI 运维助手</small></div><button class="icon-button sidebar-close" aria-label="关闭会话栏" @click="$emit('close')">×</button></div>
    <ElButton class="new-chat" @click="$emit('create')">＋ 新建对话</ElButton>
    <p class="sidebar-label">会话历史 · 当前页面</p>
    <nav class="conversation-list" aria-label="历史对话">
      <div v-for="chat in conversations" :key="chat.id" class="conversation-row" :class="{ active: activeId === chat.id }">
        <button class="conversation-title" :title="chat.title" :aria-current="activeId === chat.id ? 'true' : undefined" @click="$emit('select', chat.id)">◷ <span>{{ chat.title }}</span></button>
        <button class="icon-button delete-chat" :aria-label="'删除对话：' + chat.title" @click="$emit('remove', chat.id)">×</button>
      </div>
    </nav>
    <div class="sidebar-note"><span class="status-dot" /> HolmesGPT HTTP API<p>会话仅保存在内存中，刷新页面后清除。</p></div>
  </aside>
</template>
