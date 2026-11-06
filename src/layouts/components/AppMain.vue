<script setup lang="ts">
import { computed } from 'vue';
import { useAuthStore } from '@/stores/auth';
import { useRoute } from 'vue-router';
import { usePageTabs } from '../usePageTabs';
import AppPageTabs from './AppPageTabs.vue';
import AppPageView from './AppPageView.vue';

const route = useRoute();
const auth = useAuthStore();
const { tabs, activeKey, allowed, busy, select, close, command } = usePageTabs();
const breadcrumbs = computed(() =>
  route.matched
    .filter((item) => item.meta.title)
    .map((item) => ({
      path: item.path,
      title:
        auth.user?.navigation?.find((menu) => menu.routeName === item.name)?.title ??
        item.meta.title,
    })),
);
// const pageTitle = computed(() => auth.user?.navigation?.find(menu => menu.routeName === route.name)?.title ?? route.meta.title)
</script>

<template>
  <el-main class="app-main">
    <AppPageTabs
      :items="tabs.items"
      :active-key="activeKey"
      :busy="busy"
      @select="select"
      @close="close"
      @command="command"
    />
    <div class="main-container">
      <el-breadcrumb
        class="main-breadcrumb"
        separator="/"
      >
        <el-breadcrumb-item
          v-for="(item, index) in breadcrumbs"
          :key="item.path"
          :to="index < breadcrumbs.length - 1 ? { path: item.path } : undefined"
        >
          {{ item.title }}
        </el-breadcrumb-item>
      </el-breadcrumb>
      <!-- <div class="page-heading"><h1>{{ pageTitle }}</h1><span v-if="route.name === 'devices'">查看和管理工作空间中的设备</span></div> -->
      <AppPageView
        :items="tabs.items"
        :active-key="activeKey"
        :allowed="allowed"
        :owner="auth.user?.id ?? ''"
      />
    </div>
  </el-main>
</template>

<style scoped lang="scss">
.app-main {
  min-width: 0;
  flex: 1;
  padding: 0;
}
.main-container {
  width: 100%;
  padding: var(--app-page-padding);
  box-sizing: border-box;
}
.page-heading {
  margin-bottom: var(--app-space-lg);
}
.page-heading h1 {
  font-size: 24px;
  line-height: 1.4;
  margin: 0 0 8px;
  font-weight: 600;
}
.page-heading span {
  font-size: 14px;
  color: var(--el-text-color-secondary);
}
@media (max-width: 760px) {
  .page-heading h1 {
    font-size: 20px;
  }
}
.main-breadcrumb {
  margin-bottom: 16px;
}
</style>
