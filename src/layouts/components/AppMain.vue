<script setup lang="ts">
import { computed } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { canAccessRoute } from '@/router/access'
import { RouterView, useRoute } from 'vue-router'

const route = useRoute()
const auth = useAuthStore()
const breadcrumbs = computed(() => route.matched.filter(item => item.meta.title).map(item => ({
  path: item.path, title: auth.user?.navigation?.find(menu => menu.routeName === item.name)?.title ?? item.meta.title,
})))
const pageTitle = computed(() => auth.user?.navigation?.find(menu => menu.routeName === route.name)?.title ?? route.meta.title)
</script>

<template>
  <el-main class="app-main">
    <div class="main-container">
      <el-breadcrumb class="main-breadcrumb" separator="/">
        <el-breadcrumb-item
          v-for="(item, index) in breadcrumbs"
          :key="item.path"
          :to="index < breadcrumbs.length - 1 ? { path: item.path } : undefined"
        >
          {{ item.title }}
        </el-breadcrumb-item>
      </el-breadcrumb>
      <div class="page-heading"><h1>{{ pageTitle }}</h1><span v-if="route.name === 'devices'">查看和管理工作空间中的设备</span></div>
      <RouterView v-if="auth.authenticated && canAccessRoute(route, auth)" :key="auth.user?.id" />
    </div>
  </el-main>
</template>

<style scoped lang="scss">
.app-main { min-width: 0; flex: 1; padding: var(--app-page-padding); }
.main-container { max-width: 1440px; margin: 0 auto; }
.page-heading { margin-bottom: var(--app-space-lg); }
.page-heading h1 { font-size: 24px; line-height: 1.4; margin: 0 0 8px; font-weight: 600; }
.page-heading span { font-size: 14px; color: var(--el-text-color-secondary); }
@media (max-width: 760px) { .page-heading h1 { font-size: 20px; } }
.main-breadcrumb {
  margin-bottom: 16px;
}
</style>
