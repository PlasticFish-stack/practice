<script setup lang="ts">
import { shallowRef } from 'vue'
import { ElMessage } from 'element-plus'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import UserAvatar from '@/components/UserAvatar.vue'

const auth = useAuthStore()
const router = useRouter()
const route = useRoute()
const error = shallowRef('')
async function command(value: string) {
  if (value === 'center') { await router.push({ name: 'account-center' }); return }
  if (value === 'settings') { await router.push({ name: 'account-center', query: { edit: '1' } }); return }
  if (value !== 'logout') return
  error.value = ''
  try {
    await auth.logout()
    await router.replace({ name: 'login' })
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '退出失败，请重试'
    ElMessage.error(error.value)
  }
}
</script>

<template>
  <el-dropdown trigger="click" placement="bottom-end" @command="command">
    <button class="account-trigger" type="button" aria-label="账户菜单" :disabled="auth.busy">
      <UserAvatar :user="auth.user" :size="28" />
      <span class="account-name">{{ auth.user?.displayName }}</span>
      <el-icon class="account-chevron"><ArrowDown /></el-icon>
    </button>
    <template #dropdown>
      <div class="account-dropdown">
        <div class="account-summary">
          <UserAvatar :user="auth.user" :size="40" />
          <div><strong>{{ auth.user?.displayName }}</strong><p>{{ auth.user?.email || `@${auth.user?.username}` }}</p></div>
        </div>
        <div class="account-roles"><el-tag v-for="role in auth.user?.roles" :key="role" size="small" effect="plain">{{ role }}</el-tag></div>
        <el-dropdown-menu>
          <el-dropdown-item command="center" :class="{ 'is-selected': route.name === 'account-center' && route.query.edit !== '1' }" :aria-current="route.name === 'account-center' && route.query.edit !== '1' ? 'page' : undefined"><el-icon><User /></el-icon>个人中心</el-dropdown-item>
          <el-dropdown-item command="settings" :class="{ 'is-selected': route.name === 'account-center' && route.query.edit === '1' }" :aria-current="route.name === 'account-center' && route.query.edit === '1' ? 'page' : undefined"><el-icon><Setting /></el-icon>个人设置</el-dropdown-item>
          <li class="account-divider" role="separator" />
          <el-dropdown-item command="logout" :disabled="auth.busy"><el-icon><SwitchButton /></el-icon>退出登录</el-dropdown-item>
        </el-dropdown-menu>
      </div>
    </template>
  </el-dropdown>
</template>

<style scoped>
.account-trigger { height: 48px; display: flex; align-items: center; gap: var(--app-space-xs); border: 0; border-radius: var(--app-radius-base); background: transparent; color: var(--el-text-color-regular); padding: 0 var(--app-space-xs); cursor: pointer; }
.account-trigger:hover { background: var(--el-fill-color-light); }
.account-trigger:focus-visible { outline: 2px solid var(--el-color-primary); outline-offset: -2px; }
.account-name { max-width: 112px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 14px; }
.account-chevron { font-size: 11px; color: var(--el-text-color-secondary); }
.account-dropdown { width: 256px; padding: var(--app-space-xs) 0 var(--app-space-2xs); }
.account-dropdown :deep(.el-dropdown-menu) { padding: var(--app-space-xs) var(--app-space-2xs); }
.account-summary { display: flex; gap: var(--app-space-sm); padding: var(--app-space-sm) var(--app-space-md) var(--app-space-xs); align-items: center; }
.account-summary > div { min-width: 0; }
.account-summary strong { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.account-summary p { margin: 4px 0 0; font-size: 12px; color: var(--el-text-color-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.account-roles { display: flex; flex-wrap: wrap; gap: var(--app-space-xs); padding: 0 var(--app-space-md) var(--app-space-sm); border-bottom: var(--app-border-secondary); }
.account-divider { height: 1px; margin: var(--app-space-2xs) var(--app-space-xs); background: var(--app-color-border-secondary); list-style: none; }
@media (max-width: 600px) { .account-name, .account-chevron { display: none; } }
</style>
