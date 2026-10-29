<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { ElButton, ElMessageBox } from 'element-plus'
import { useChatStore } from '../stores/chat'
import { appConfig } from '../config'
import ConversationSidebar from '../components/chat/ConversationSidebar.vue'
import ChatMessageList from '../components/chat/ChatMessageList.vue'
import ChatComposer from '../components/chat/ChatComposer.vue'
const chat = useChatStore()
const sidebarOpen = ref(window.matchMedia('(min-width: 769px)').matches)
const draft = ref('')
const blocked = computed(() => !!chat.current?.turns.length && chat.current.turns.at(-1)!.status !== 'completed')
watch(() => chat.activeId, () => { draft.value = ''; if (window.matchMedia('(max-width: 768px)').matches) sidebarOpen.value = false })
function send() {
  if (chat.busy || blocked.value || !draft.value.trim()) return
  const text = draft.value
  draft.value = ''
  void chat.send(text)
}
async function clear() {
  try { await ElMessageBox.confirm('将清空本会话内容，并停止正在进行的请求。', '清空对话', { confirmButtonText: '清空', cancelButtonText: '取消', type: 'warning' }); chat.clearCurrent() } catch { /* 用户取消。 */ }
}
async function remove(id: string) {
  try { await ElMessageBox.confirm('删除后无法恢复。', '删除会话', { confirmButtonText: '删除', cancelButtonText: '取消', type: 'warning' }); chat.remove(id) } catch { /* 用户取消。 */ }
}
onBeforeUnmount(() => chat.stop())
</script>

<template>
  <div class="app-layout" :class="{ 'sidebar-expanded': sidebarOpen }">
    <ConversationSidebar :conversations="chat.conversations" :active-id="chat.activeId" :open="sidebarOpen" @create="chat.newConversation()" @select="chat.select" @remove="remove" @close="sidebarOpen = false" />
    <main class="chat-main">
      <header class="chat-header"><div class="header-left"><button class="icon-button toggle-sidebar" :aria-expanded="sidebarOpen" aria-label="展开或折叠会话栏" @click="sidebarOpen = !sidebarOpen">☰</button><div><strong>HolmesGPT</strong><span class="model-label">{{ appConfig.model || '服务端默认模型' }}</span></div></div><ElButton text :disabled="!chat.current?.turns.length" @click="clear">清空对话</ElButton></header>
      <ChatMessageList v-if="chat.current" :conversation="chat.current" :busy="chat.busy" @regenerate="chat.regenerate()" @suggestion="draft = $event" />
      <ChatComposer v-model="draft" :busy="chat.busy" :blocked="blocked" @send="send" @stop="chat.stop()" />
    </main>
  </div>
</template>
