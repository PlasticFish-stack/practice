<script setup lang="ts">
import { shallowRef } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import AppTable from '@/components/AppTable/AppTable.vue'
import type { ColumnOptions } from '@/components/AppTable/types'
import { useAuthStore } from '@/stores/auth'
import { PERMISSIONS } from '@/auth/permissions'
import { systemApi } from '@/api/system'
import type { UserRecord } from '@/types/system'
import { useSystemList } from './useSystemList'
import UserEditor from './components/UserEditor.vue'

const auth = useAuthStore()
const { query, rows, total, catalog, loading, error, reload, search, paginate, refresh } = useSystemList(systemApi.users)
const keyword = shallowRef('')
const editing = shallowRef(false)
const selected = shallowRef<UserRecord | null>(null)
const deleting = shallowRef(false)
const columns: ColumnOptions<UserRecord>[] = [
  { prop: 'username', label: '用户名', minWidth: 140 }, { prop: 'displayName', label: '显示名称', minWidth: 140 },
  { prop: 'email', label: '邮箱', minWidth: 200 }, { prop: 'roleIds', label: '角色', minWidth: 180 },
  { prop: 'enabled', label: '状态', width: 100 }, { key: 'actions', label: '操作', width: 150, fixed: 'right' },
]
function edit(row: UserRecord | null) { selected.value = row; editing.value = true }
function canManage(row: UserRecord) { return row.roleIds.every(id => catalog.value.roles.find(role => role.id === id)?.permissions.every(code => auth.user?.permissions.includes(code))) }
async function saved() { editing.value = false; ElMessage.success('用户已保存'); await refresh() }
async function remove(row: UserRecord) {
  if (deleting.value || !auth.can(PERMISSIONS.userWrite)) return
  try { await ElMessageBox.confirm(`确定删除用户“${row.displayName}”？其登录会话将失效。`, '删除用户', { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' }) }
  catch { return }
  deleting.value = true; error.value = ''
  try { await systemApi.deleteUser(row.id, row.version); ElMessage.success('用户已删除'); await refresh() }
  catch (cause) { error.value = cause instanceof Error ? cause.message : '删除失败，请重试' }
  finally { deleting.value = false }
}
</script>

<template>
  <div class="system-page">
    <el-alert v-if="error" :title="error" type="error" :closable="false" role="alert" />
    <form class="system-search" @submit.prevent="search(keyword)"><el-input v-model="keyword" aria-label="搜索用户" placeholder="用户名、显示名称或邮箱" clearable maxlength="100" />
      <el-button native-type="submit" type="primary" :loading="loading">搜索</el-button><el-button :disabled="loading" @click="keyword = ''; search('')">重置</el-button></form>
    <AppTable :rows="rows" :column-options="columns" :loading="loading" title="用户列表" description="通过角色授予用户权限"
      :pagination="{ page: query.page, pageSize: query.pageSize, total }" @page-change="paginate">
      <template #toolbar><el-button :disabled="loading" @click="reload">刷新</el-button><el-button v-if="auth.can(PERMISSIONS.userWrite)" type="primary" :disabled="loading" @click="edit(null)">新增用户</el-button></template>
      <template #cell-roleIds="{ row }"><div class="system-tags"><el-tag v-for="id in row.roleIds" :key="id" :type="catalog.roles.find(role => role.id === id)?.enabled ? 'primary' : 'info'">{{ catalog.roles.find(role => role.id === id)?.name ?? id }}</el-tag><span v-if="!row.roleIds.length" class="system-empty">未分配角色</span></div></template>
      <template #cell-enabled="{ row }"><el-tag :type="row.enabled ? 'success' : 'info'">{{ row.enabled ? '启用' : '停用' }}</el-tag></template>
      <template #cell-actions="{ row }"><template v-if="auth.can(PERMISSIONS.userWrite) && canManage(row)"><el-button link type="primary" @click="edit(row)">编辑</el-button><el-button link type="danger" :disabled="deleting || row.id === auth.user?.id" @click="remove(row)">删除</el-button></template><span v-else class="system-empty">只读</span></template>
    </AppTable>
    <UserEditor v-if="editing" :user="selected" :roles="catalog.roles" @close="editing = false" @saved="saved" />
  </div>
</template>

<style scoped src="./system.css"></style>
