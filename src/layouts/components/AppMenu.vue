<script setup lang="ts">
import { computed, nextTick, useTemplateRef, watch } from 'vue';
import type { MenuInstance } from 'element-plus';
import { useAuthStore } from '@/stores/auth';
import { accessibleMenus } from '@/router/access';
import { useRoute, useRouter } from 'vue-router';
import { menuTrail } from '@/router/menu';
import AppMenuItem from './AppMenuItem.vue';

const props = defineProps<{ isCollapse?: boolean }>();
const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const menuItems = computed(() => accessibleMenus(router, auth));
const menu = useTemplateRef<MenuInstance>('menu');
const activeIndex = computed(() => {
  // 隐藏详情页沿用最近的可见菜单祖先，选中项不依赖 URL 的字符串截断。
  for (const record of [...route.matched].reverse()) {
    if (typeof record.name === 'string' && menuTrail(menuItems.value, record.name).length)
      return record.name;
  }
  return '';
});
const activeTrail = computed(() => menuTrail(menuItems.value, activeIndex.value));

watch(
  [activeIndex, menu, () => props.isCollapse],
  async (_value, _previous, onCleanup) => {
    if (props.isCollapse || !menu.value) return;
    let stale = false;
    onCleanup(() => {
      stale = true;
    });
    // 等待递归子菜单完成挂载注册，再调用 Element Plus 的 open。
    await nextTick();
    if (stale || props.isCollapse) return;
    // 会话刷新会重建菜单树；选中项未变化时保留用户手动展开/收起的状态。
    for (const index of activeTrail.value.slice(0, -1)) menu.value?.open(index);
  },
  { flush: 'post' },
);
</script>

<template>
  <div
    class="menu-viewport"
    :class="{ 'is-collapsed': isCollapse }"
    role="navigation"
    aria-label="主导航"
  >
    <el-menu
      ref="menu"
      class="app-menu"
      router
      :collapse="isCollapse"
      :collapse-transition="false"
      :default-active="activeIndex"
    >
      <AppMenuItem
        v-for="item in menuItems"
        :key="item.index"
        :item="item"
      />
    </el-menu>
  </div>
</template>

<style scoped lang="scss">
.menu-viewport {
  width: var(--app-sidebar-menu-width, 220px);
  min-height: 0;
  flex: 1;
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior-y: contain;
  scrollbar-width: thin;
  scrollbar-color: var(--app-color-border) transparent;
  transition: width 200ms ease;
}

.menu-viewport.is-collapsed {
  width: var(--app-menu-collapsed-width);
}

@media (prefers-reduced-motion: reduce) {
  .menu-viewport {
    transition: none;
  }
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
