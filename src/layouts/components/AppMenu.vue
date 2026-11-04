<script setup lang="ts">
import { computed, useTemplateRef, watch } from 'vue'
import type { MenuInstance } from 'element-plus'
import { useAuthStore } from '@/stores/auth'
import { accessibleMenus } from '@/router/access'
import { useRoute, useRouter } from 'vue-router'
import { menuTrail } from '@/router/menu'
import AppMenuItem from './AppMenuItem.vue'

const props = defineProps<{ isCollapse?: boolean }>()
const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const menuItems = computed(() => accessibleMenus(router, auth))
const menu = useTemplateRef<MenuInstance>('menu')
const activeIndex = computed(() => {
  // 隐藏详情页沿用最近的可见菜单祖先，选中项不依赖 URL 的字符串截断。
  for (const record of [...route.matched].reverse()) {
    if (typeof record.name === 'string' && menuTrail(menuItems.value, record.name).length) return record.name
  }
  return ''
})
const activeTrail = computed(() => menuTrail(menuItems.value, activeIndex.value))

watch([activeTrail, menu], ([trail]) => {
  if (props.isCollapse) return
  for (const index of trail.slice(0, -1)) menu.value?.open(index)
}, { flush: 'post' })
</script>

<template>
  <div class="menu-viewport" :class="{ 'is-collapsed': isCollapse }">
    <el-menu ref="menu" class="app-menu" router :collapse="isCollapse" :collapse-transition="false" :default-active="activeIndex"
      :default-openeds="activeTrail.slice(0, -1)">
      <AppMenuItem v-for="item in menuItems" :key="item.index" :item="item" />
    </el-menu>
  </div>
</template>

<style scoped lang="scss">
.menu-viewport {
  width: var(--app-sidebar-menu-width, 220px);
  overflow: hidden;
  transition: width 200ms ease;
}

.menu-viewport.is-collapsed {
  width: var(--app-menu-collapsed-width);
}

@media (prefers-reduced-motion: reduce) {
  .menu-viewport { transition: none; }
}

.app-menu {
  border-right: 0;
  background-color: transparent;
}

.app-menu:not(.el-menu--collapse) {
  width: var(--app-sidebar-menu-width, 220px);
}

.app-menu.el-menu--collapse {
  width: var(--app-menu-collapsed-width);
}
</style>
