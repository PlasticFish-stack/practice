<script setup lang="ts">
import { computed, shallowRef } from 'vue';
import { Check, Expand, Fold, FullScreen, Moon, QuestionFilled, Sunny } from '@/components/icons';
import { useFullscreen, useMediaQuery } from '@vueuse/core';
import { ElMessage } from 'element-plus';
import { useRoute } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { usePreferencesStore } from '@/stores/preferences';
import { useThemeTransition } from '@/composables/useThemeTransition';
import AppAccountMenu from './AppAccountMenu.vue';
import AppNavigationSearch from './AppNavigationSearch.vue';
import brandLogo from '@/assets/whalestack.svg';
import brandLogoDark from '@/assets/whalestack-dark.svg';

const props = defineProps<{ collapsed: boolean }>();
const emit = defineEmits<{ toggleSidebar: [] }>();
const preferences = usePreferencesStore();
const route = useRoute();
const auth = useAuthStore();
const mobile = useMediaQuery('(max-width: 760px)');
const pageTitle = computed(
  () =>
    auth.user?.navigation?.find((item) => item.routeName === route.name)?.title ??
    route.meta.title ??
    '工作台',
);
const themeTransition = useThemeTransition();
function changeTheme(value: string) {
  void themeTransition.setTheme(value);
}
const helpOpen = shallowRef(false);
const { isFullscreen, toggle } = useFullscreen();
async function fullscreen() {
  try {
    await toggle();
  } catch {
    ElMessage.warning('当前浏览器暂不支持切换全屏');
  }
}
</script>

<template>
  <header class="app-header">
    <div class="header-brand">
      <div
        class="header-logo"
        title="鲸栈"
      >
        <img
          :src="preferences.dark ? brandLogoDark : brandLogo"
          alt="鲸栈"
          width="32"
          height="32"
          draggable="false"
        />
      </div>
      <button
        v-if="mobile"
        class="header-action collapse-action"
        type="button"
        :aria-label="props.collapsed ? '展开侧栏' : '收起侧栏'"
        :aria-expanded="!props.collapsed"
        @click="emit('toggleSidebar')"
      >
        <el-icon>
          <Expand v-if="props.collapsed" />
          <Fold v-else />
        </el-icon>
      </button>
      <strong
        class="header-page-title"
        :title="pageTitle"
      >
        {{ pageTitle }}
      </strong>
    </div>
    <nav
      class="header-tools"
      aria-label="顶部工具导航"
    >
      <AppNavigationSearch />
      <el-tooltip
        content="使用帮助"
        placement="bottom"
      >
        <button
          class="header-action secondary-action"
          aria-label="使用帮助"
          type="button"
          @click="helpOpen = true"
        >
          <el-icon><QuestionFilled /></el-icon>
        </button>
      </el-tooltip>
      <el-tooltip
        :content="isFullscreen ? '退出全屏' : '全屏显示'"
        placement="bottom"
      >
        <button
          class="header-action secondary-action"
          :aria-label="isFullscreen ? '退出全屏' : '全屏显示'"
          type="button"
          @click="fullscreen"
        >
          <el-icon><FullScreen /></el-icon>
        </button>
      </el-tooltip>
      <el-dropdown
        trigger="click"
        placement="bottom-end"
        popper-class="theme-options-popper"
        @command="changeTheme"
      >
        <button
          class="header-action"
          aria-label="切换主题"
          type="button"
          @click="themeTransition.cancel"
        >
          <el-icon>
            <Moon v-if="preferences.dark" />
            <Sunny v-else />
          </el-icon>
        </button>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item
              command="light"
              :class="{ 'is-selected': preferences.theme === 'light' }"
            >
              浅色模式
              <el-icon v-if="preferences.theme === 'light'"><Check /></el-icon>
            </el-dropdown-item>
            <el-dropdown-item
              command="dark"
              :class="{ 'is-selected': preferences.theme === 'dark' }"
            >
              深色模式
              <el-icon v-if="preferences.theme === 'dark'"><Check /></el-icon>
            </el-dropdown-item>
            <el-dropdown-item
              command="system"
              :class="{ 'is-selected': preferences.theme === 'system' }"
            >
              跟随系统
              <el-icon v-if="preferences.theme === 'system'"><Check /></el-icon>
            </el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
      <div class="tools-divider" />
      <AppAccountMenu v-if="auth.authenticated" />
    </nav>
    <el-dialog
      v-model="helpOpen"
      title="使用帮助"
      width="480px"
      class="header-dialog"
    >
      <div class="help-content">
        <h3>欢迎使用设备工作空间</h3>
        <p>通过侧栏浏览你有权访问的页面，使用右上角搜索或 Ctrl / ⌘ + K 快速跳转。</p>
        <ul>
          <li>设备列表支持查询、分页和设备编辑。</li>
          <li>头像菜单中可以查看账户信息和更新个人资料。</li>
          <li>支持浅色、深色和跟随系统三种主题。</li>
          <li>如需新增访问权限，请联系管理员。</li>
        </ul>
        <p class="help-note">离开公共设备前，请通过头像菜单退出登录。</p>
      </div>
    </el-dialog>
  </header>
</template>

<style scoped>
.app-header {
  --header-padding-inline: var(--app-page-padding);
  height: 56px;
  flex-shrink: 0;
  position: sticky;
  top: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 var(--header-padding-inline);
  gap: var(--app-space-md);
  background: var(--el-bg-color);
  border-bottom: var(--app-border-secondary);
  box-sizing: border-box;
}
.header-brand {
  display: flex;
  align-items: center;
}
.header-brand {
  gap: var(--app-space-md);
  min-width: 0;
  flex: 1;
  height: 100%;
}
.header-logo {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 100%;
  flex-shrink: 0;
}
.header-logo img {
  display: block;
  width: 32px;
  height: 32px;
}
.header-page-title {
  font-size: 17px;
  font-weight: 600;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.header-tools {
  display: flex;
  align-items: center;
  gap: var(--app-space-2xs);
  height: 100%;
  min-width: 0;
  flex-shrink: 0;
}
.header-action {
  display: inline-flex;
  justify-content: center;
  align-items: center;
  flex-shrink: 0;
  width: 36px;
  height: 36px;
  padding: 0;
  background: transparent;
  border: 0;
  border-radius: var(--app-radius-base);
  color: var(--el-text-color-regular);
  cursor: pointer;
  font-size: var(--app-icon-size-lg);
}
.header-action:hover {
  background: var(--el-fill-color-light);
  color: var(--el-color-primary);
}
.header-action:focus-visible {
  outline: 2px solid var(--el-color-primary);
}
.tools-divider {
  height: 20px;
  border-left: 1px solid var(--el-border-color-lighter);
  margin: 0 6px;
}
.help-content {
  color: var(--el-text-color-regular);
  line-height: 1.8;
}
.help-content h3 {
  margin-top: 0;
  color: var(--el-text-color-primary);
}
.help-content ul {
  padding-left: 20px;
}
.help-note {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}
@media (max-width: 600px) {
  .app-header {
    --header-padding-inline: var(--app-space-sm);
    gap: var(--app-space-xs);
  }
  .secondary-action,
  .tools-divider {
    display: none;
  }
  .header-brand {
    gap: var(--app-space-sm);
  }
  .header-page-title {
    font-size: 15px;
  }
  .header-tools {
    gap: 0;
  }
}
</style>
<style>
.header-dialog {
  max-width: calc(100vw - 32px);
}
</style>
