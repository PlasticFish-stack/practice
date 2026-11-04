<script setup lang="ts">
import { shallowRef } from 'vue'
import { ElMessage } from 'element-plus'
import AppTable from '@/components/AppTable/AppTable.vue'
import type { ColumnOptions } from '@/components/AppTable/types'
import { useAuthStore } from '@/stores/auth'
import { PERMISSIONS } from '@/auth/permissions'
import { systemApi } from '@/api/system'
import type { MenuSetting } from '@/types/system'
import { useSystemList } from './useSystemList'
import MenuEditor from './components/MenuEditor.vue'

const auth = useAuthStore()
const { query, rows, total, catalog, loading, error, reload, search, paginate, refresh } = useSystemList<MenuSetting>(async (query, signal) => {
  const keyword = query.keyword.toLowerCase()
  const menus = (await systemApi.menus(signal)).filter(item => `${item.title} ${item.path}`.toLowerCase().includes(keyword))
  return { list: menus.slice((query.page - 1) * query.pageSize, query.page * query.pageSize), page: query.page, pageSize: query.pageSize, total: menus.length }
})
const keyword = shallowRef('')
const selected = shallowRef<MenuSetting | null>(null)
const columns: ColumnOptions<MenuSetting>[] = [
  { prop: 'title', label: '菜单名称', minWidth: 180 }, { prop: 'path', label: '页面地址', minWidth: 210 },
  { prop: 'order', label: '排序', width: 80 }, { prop: 'visible', label: '显示', width: 100 },
  { prop: 'permissions', label: '访问权限', minWidth: 230 }, { key: 'actions', label: '操作', width: 100, fixed: 'right' },
]
async function saved() { selected.value = null; ElMessage.success('菜单已保存'); await refresh() }
</script>

<template>
  <div class="system-page">
    <el-alert v-if="error" :title="error" type="error" :closable="false" role="alert" />
    <p class="system-notice">配置已有页面的导航入口。隐藏菜单不会撤销访问权限，访问权限需全部满足；系统入口保留必要权限。</p>
    <form class="system-search" @submit.prevent="search(keyword)"><el-input v-model="keyword" aria-label="搜索菜单" placeholder="菜单名称或页面地址" clearable maxlength="100" />
      <el-button native-type="submit" type="primary" :loading="loading">搜索</el-button><el-button :disabled="loading" @click="keyword = ''; search('')">重置</el-button></form>
    <AppTable :rows="rows" :column-options="columns" :loading="loading" title="菜单列表"
      :pagination="{ page: query.page, pageSize: query.pageSize, total }" @page-change="paginate">
      <template #toolbar><el-button :disabled="loading" @click="reload">刷新</el-button></template>
      <template #cell-title="{ row }"><div class="system-tags" :style="{ paddingInlineStart: row.parent ? '16px' : '0' }"><el-icon><component :is="row.icon" /></el-icon>{{ row.title }}</div></template>
      <template #cell-visible="{ row }"><el-tag :type="row.visible ? 'success' : 'info'">{{ row.visible ? '显示' : '隐藏' }}</el-tag></template>
      <template #cell-permissions="{ row }"><div class="system-tags"><el-tag v-for="code in row.permissions" :key="code" size="small">{{ catalog.permissions.find(item => item.code === code)?.label ?? code }}</el-tag><span v-if="!row.permissions.length" class="system-empty">所有已登录用户</span></div></template>
      <template #cell-actions="{ row }"><el-button v-if="auth.can(PERMISSIONS.menuWrite)" link type="primary" @click="selected = row">编辑</el-button><span v-else class="system-empty">只读</span></template>
    </AppTable>
    <MenuEditor v-if="selected" :menu="selected" :catalog="catalog" @close="selected = null" @saved="saved" />
  </div>
</template>

<style scoped src="./system.css"></style>
