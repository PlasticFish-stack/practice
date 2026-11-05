<script setup lang="ts">
import { ArrowLeft } from '@/components/icons';
import deepseekImage from '@/assets/deepseek_menu.png';
const isCollapse = defineModel<boolean>('collapsed', { default: false });
</script>

<template>
  <el-aside
    class="app-sidebar"
    width="auto"
  >
    <div id="aside-container">
      <button
        id="aside-btn"
        type="button"
        :aria-expanded="!isCollapse"
        :aria-label="isCollapse ? '展开侧栏' : '收起侧栏'"
        @click="isCollapse = !isCollapse"
      >
        <el-icon
          id="aside-btn-icon"
          :class="{ 'is-collapse': isCollapse }"
        >
          <ArrowLeft />
        </el-icon>
      </button>
      <slot :isCollapse="isCollapse"></slot>
      <div
        class="sidebar-illustration"
        :class="{ 'is-collapsed': isCollapse }"
        aria-hidden="true"
      >
        <img
          :src="deepseekImage"
          alt=""
          width="180"
          height="180"
          draggable="false"
        />
      </div>
    </div>
  </el-aside>
</template>

<style scoped lang="scss">
.app-sidebar {
  position: sticky;
  top: 56px;
  height: calc(100dvh - 56px);
  flex-shrink: 0;
  overflow: visible;
  background: var(--el-bg-color);
}

.sidebar-illustration {
  flex-shrink: 0;
  height: 180px;
  margin-inline: calc(-1 * var(--app-menu-sidebar-padding));
  margin-bottom: calc(-1 * var(--app-menu-sidebar-padding));
  overflow: hidden;
  pointer-events: none;
  user-select: none;
  transition: height 200ms ease;
}

.sidebar-illustration img {
  display: block;
  width: 180px;
  max-width: 100%;
  height: auto;
  transform-origin: bottom left;
  transition: width 200ms ease;
}

.sidebar-illustration.is-collapsed {
  height: 64px;
}

.sidebar-illustration.is-collapsed img {
  width: 64px;
}

@media (prefers-reduced-motion: reduce) {
  .sidebar-illustration,
  .sidebar-illustration img {
    transition: none;
  }
}

@media (max-height: 600px) {
  .sidebar-illustration {
    display: none;
  }
}

#aside-container {
  --aside-btn-size: 30px;
  box-sizing: border-box;
  height: 100%;
  display: flex;
  flex-direction: column;
  min-height: 0;
  padding: var(--app-menu-sidebar-padding);
  border-right: var(--app-border-secondary);
  position: relative;

  #aside-btn {
    height: var(--aside-btn-size);
    width: var(--aside-btn-size);
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--app-radius-round);
    border: var(--app-border);
    background-color: var(--el-bg-color-overlay);
    box-sizing: border-box;
    position: absolute;
    cursor: pointer;
    top: calc(var(--aside-btn-size) / 1.2);
    right: calc(var(--aside-btn-size) / -1.5);
    z-index: 1;
  }

  #aside-btn-icon {
    font-size: 16px;
    opacity: 0.7;
    transition: opacity 0.2s;
  }

  #aside-btn-icon.is-collapse {
    transform: rotate(180deg);
  }

  #aside-btn:hover #aside-btn-icon {
    opacity: 1;
  }
}
</style>
