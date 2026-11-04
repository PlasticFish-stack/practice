<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router'
import { safeDestination } from '@/router/access'
import { useAuthStore } from '@/stores/auth'
const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
function retry() {
  // 只允许站内地址，实际权限由目标页面的路由守卫重新确认。
  const candidate = route.query.redirect
  const destination = typeof candidate === 'string' && /^\/(?!\/)/.test(candidate)
    // eslint-disable-next-line no-control-regex -- Intentionally reject control characters in redirect URLs.
    && !/[\\\u0000-\u0020]/.test(candidate) && !candidate.startsWith('/session-error')
    ? candidate : safeDestination(undefined, router, auth)
  void router.replace(destination)
}
</script>

<template>
  <main class="session-error">
    <h1>暂时无法确认登录状态</h1>
    <p>会话服务暂不可用，请稍后重试。</p>
    <el-button type="primary" @click="retry">重试</el-button>
    <el-button @click="router.replace({ name: 'login' })">前往登录</el-button>
  </main>
</template>

<style scoped>
.session-error { padding: 64px 24px; text-align: center; }
</style>
