<script setup lang="ts">
import { ElConfigProvider } from 'element-plus'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import ChatView from './views/ChatView.vue'
</script>

<template><ElConfigProvider :locale="zhCn"><ChatView /></ElConfigProvider></template>
