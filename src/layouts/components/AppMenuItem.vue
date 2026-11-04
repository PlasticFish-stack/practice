<script setup lang="ts">
import type { MenuNode } from '@/router/menu'

defineProps<{ item: MenuNode }>()
</script>

<template>
  <el-sub-menu v-if="item.children.length" :index="item.index" popper-class="app-menu-popper">
    <template #title>
      <el-icon><component :is="item.icon" /></el-icon>
      <span class="menu-label" :title="item.title">{{ item.title }}</span>
    </template>
    <AppMenuItem v-for="child in item.children" :key="child.index" :item="child" />
  </el-sub-menu>
  <el-menu-item v-else :index="item.index" :route="item.path">
    <el-icon><component :is="item.icon" /></el-icon>
    <template #title>
      <span class="menu-label" :title="item.title">{{ item.title }}</span>
    </template>
  </el-menu-item>
</template>

<style scoped>
.menu-label {
  display: block;
  flex: 1;
  min-width: 0;
  text-align: left;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
