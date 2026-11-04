<script setup lang="ts">
import { shallowRef, watch } from 'vue'
import { useMediaQuery } from '@vueuse/core'
import AppSidebar from './components/AppSidebar.vue'
import AppMain from './components/AppMain.vue'
import AppMenu from './components/AppMenu.vue'
import AppHeader from './components/AppHeader.vue'
const collapsed = shallowRef(false)
const mobile = useMediaQuery('(max-width: 760px)')
watch(mobile, value => { if (value) collapsed.value = true }, { immediate: true })
</script>

<template>
  <div class="app-shell">
    <AppHeader :collapsed="collapsed" @toggle-sidebar="collapsed = !collapsed" />
    <div class="workspace-body">
      <AppSidebar v-model:collapsed="collapsed" #default="{ isCollapse }"><AppMenu :is-collapse="isCollapse" /></AppSidebar>
      <AppMain />
    </div>
  </div>
</template>

<style scoped>
.app-shell { min-height: 100dvh; color: var(--el-text-color-primary); text-align: left; background: var(--el-bg-color-page); }
.workspace-body { display: flex; min-height: calc(100dvh - 56px); align-items: flex-start; }
</style>
