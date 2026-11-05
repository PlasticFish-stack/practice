<script setup lang="ts">
import { shallowRef } from 'vue';
import {
  Check,
  Expand,
  Fold,
  FullScreen,
  Moon,
  QuestionFilled,
  Sunny,
} from '@element-plus/icons-vue';
import { useFullscreen } from '@vueuse/core';
import { ElMessage } from 'element-plus';
import { RouterLink } from 'vue-router';
import { usePreferencesStore } from '@/stores/preferences';
import { useThemeTransition } from '@/composables/useThemeTransition';
import AppAccountMenu from './AppAccountMenu.vue';
import AppNavigationSearch from './AppNavigationSearch.vue';

const props = defineProps<{ collapsed: boolean }>();
const emit = defineEmits<{ toggleSidebar: [] }>();
const preferences = usePreferencesStore();
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
      <RouterLink
        to="/"
        class="brand-link"
        aria-label="设备管理首页"
      >
        <svg
          width="28"
          height="28"
          viewBox="0 0 28 28"
          aria-hidden="true"
        >
          <path
            d="M14 1 27 14 14 27 1 14Z"
            fill="var(--app-color-primary)"
          />
          <path
            d="M14 6 22 14 14 22 6 14Z"
            fill="var(--el-bg-color)"
          />
          <rect
            x="11"
            y="11"
            width="6"
            height="6"
            rx="1.5"
            fill="var(--app-color-primary-hover)"
          />
        </svg>
        <strong>
          设备管理
          <span>Workspace</span>
        </strong>
      </RouterLink>
      <button
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
      <AppAccountMenu />
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
  height: 56px;
  flex-shrink: 0;
  position: sticky;
  top: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 var(--app-page-padding);
  gap: var(--app-space-md);
  background: var(--el-bg-color);
  border-bottom: var(--app-border-secondary);
  box-sizing: border-box;
}
.header-brand,
.brand-link {
  display: flex;
  align-items: center;
}
.header-brand {
  gap: 28px;
  min-width: 0;
}
.brand-link {
  gap: 10px;
  text-decoration: none;
  color: var(--el-text-color-primary);
  white-space: nowrap;
}
.brand-link strong {
  font-size: 17px;
  font-weight: 600;
}
.brand-link strong span {
  color: var(--el-text-color-placeholder);
  font-size: 11px;
  font-weight: 400;
  margin-left: 10px;
  letter-spacing: 0.5px;
}
.header-tools {
  display: flex;
  align-items: center;
  gap: var(--app-space-2xs);
  height: 100%;
  min-width: 0;
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
  font-size: 18px;
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
@media (max-width: 1000px) {
  .brand-link strong span {
    display: none;
  }
  .header-brand {
    gap: var(--app-space-md);
  }
}
@media (max-width: 600px) {
  .app-header {
    padding: 0 var(--app-space-sm);
    gap: var(--app-space-xs);
  }
  .brand-link strong,
  .secondary-action,
  .tools-divider {
    display: none;
  }
  .header-brand {
    gap: var(--app-space-xs);
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
