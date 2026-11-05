<script setup lang="ts">
import { onDeactivated, shallowRef } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import AppTable from '@/components/AppTable/AppTable.vue';
import type { ColumnOptions } from '@/components/AppTable/types';
import { useAuthStore } from '@/stores/auth';
import { PERMISSIONS } from '@/auth/permissions';
import { systemApi } from '@/api/system';
import type { RoleRecord } from '@/types/system';
import { useSystemList } from './useSystemList';
import RoleEditor from './components/RoleEditor.vue';

const auth = useAuthStore();
const { query, rows, total, catalog, loading, error, reload, search, paginate, refresh } =
  useSystemList(systemApi.roles);
const keyword = shallowRef('');
function resetSearch() {
  keyword.value = '';
  search('');
}
const editing = shallowRef(false);
const selected = shallowRef<RoleRecord | null>(null);
const deleting = shallowRef(false);
onDeactivated(() => {
  editing.value = false;
});
const columns: ColumnOptions<RoleRecord>[] = [
  { prop: 'name', label: '角色名称', minWidth: 160 },
  { prop: 'code', label: '角色编码', minWidth: 130 },
  { prop: 'description', label: '描述', minWidth: 180, showOverflowTooltip: true },
  { prop: 'permissions', label: '权限', minWidth: 260 },
  { prop: 'enabled', label: '状态', width: 100 },
  { key: 'actions', label: '操作', width: 150, fixed: 'right' },
];
function edit(row: RoleRecord | null) {
  selected.value = row;
  editing.value = true;
}
async function saved() {
  editing.value = false;
  ElMessage.success('角色已保存');
  await refresh();
}
async function remove(row: RoleRecord) {
  if (deleting.value || !auth.can(PERMISSIONS.roleWrite)) return;
  try {
    await ElMessageBox.confirm(
      `确定删除角色“${row.name}”？已分配给用户的角色需要先解除分配。`,
      '删除角色',
      { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' },
    );
  } catch {
    return;
  }
  deleting.value = true;
  error.value = '';
  try {
    await systemApi.deleteRole(row.id, row.version);
    ElMessage.success('角色已删除');
    await refresh();
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '删除失败，请重试';
  } finally {
    deleting.value = false;
  }
}
</script>

<template>
  <div class="system-page">
    <el-alert
      v-if="error"
      :title="error"
      type="error"
      :closable="false"
      role="alert"
    />
    <form
      class="system-search"
      @submit.prevent="search(keyword)"
    >
      <el-input
        v-model="keyword"
        aria-label="搜索角色"
        placeholder="角色名称、编码或描述"
        clearable
        maxlength="100"
      />
      <el-button
        native-type="submit"
        type="primary"
        :aria-disabled="loading"
      >
        搜索
      </el-button>
      <el-button
        :disabled="loading"
        @click="resetSearch"
      >
        重置
      </el-button>
    </form>
    <AppTable
      table-key="system.roles"
      :rows="rows"
      :column-options="columns"
      :loading="loading"
      title="角色列表"
      description="权限由启用的角色合并计算"
      :pagination="{ page: query.page, pageSize: query.pageSize, total }"
      @page-change="paginate"
    >
      <template #toolbar>
        <el-button
          :disabled="loading"
          @click="reload"
        >
          刷新
        </el-button>
        <el-button
          v-if="auth.can(PERMISSIONS.roleWrite)"
          type="primary"
          :disabled="loading"
          @click="edit(null)"
        >
          新增角色
        </el-button>
      </template>
      <template #cell-name="{ row }">
        <div class="system-tags">
          {{ row.name }}
          <el-tag
            v-if="row.protected"
            size="small"
          >
            内置
          </el-tag>
        </div>
      </template>
      <template #cell-permissions="{ row }">
        <div class="system-tags">
          <el-tag
            v-for="code in row.permissions"
            :key="code"
            size="small"
          >
            {{ catalog.permissions.find((item) => item.code === code)?.label ?? code }}
          </el-tag>
          <span
            v-if="!row.permissions.length"
            class="system-empty"
          >
            无权限
          </span>
        </div>
      </template>
      <template #cell-enabled="{ row }">
        <el-tag :type="row.enabled ? 'success' : 'info'">
          {{ row.enabled ? '启用' : '停用' }}
        </el-tag>
      </template>
      <template #cell-actions="{ row }">
        <template
          v-if="
            auth.can(PERMISSIONS.roleWrite) &&
            !row.protected &&
            row.permissions.every((code) => auth.user?.permissions.includes(code))
          "
        >
          <el-button
            link
            type="primary"
            @click="edit(row)"
          >
            编辑
          </el-button>
          <el-button
            link
            type="danger"
            :disabled="deleting"
            @click="remove(row)"
          >
            删除
          </el-button>
        </template>
        <span
          v-else
          class="system-empty"
        >
          {{ row.protected ? '受保护' : '只读' }}
        </span>
      </template>
    </AppTable>
    <RoleEditor
      v-if="editing"
      :role="selected"
      :catalog="catalog"
      @close="editing = false"
      @saved="saved"
    />
  </div>
</template>

<style scoped src="./system.css"></style>
