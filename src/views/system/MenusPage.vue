<script setup lang="ts">
import { menuIcon } from '@/components/menuIcons';
import { computed, onDeactivated, shallowRef, useTemplateRef } from 'vue';
import { ElMessage } from 'element-plus';
import AppTable from '@/components/AppTable/AppTable.vue';
import type { ColumnOptions, TableHandle } from '@/components/AppTable/types';
import { useAuthStore } from '@/stores/auth';
import { PERMISSIONS } from '@/auth/permissions';
import { systemApi } from '@/api/system';
import type { MenuSetting } from '@/types/system';
import { useSystemList } from './useSystemList';
import MenuEditor from './components/MenuEditor.vue';

const auth = useAuthStore();
const { query, rows, catalog, loading, error, reload, search, refresh } =
  useSystemList<MenuSetting>(async (query, signal) => {
    const menus = await systemApi.menus(signal);
    return {
      list: menus,
      page: 1,
      pageSize: Math.max(query.pageSize, menus.length),
      total: menus.length,
    };
  });
type MenuNode = MenuSetting & { children?: MenuNode[] };
const table = useTemplateRef<TableHandle<MenuNode>>('menuTable');
const savingOrder = shallowRef(false);
const treeRows = computed(() => {
  const nodes = new Map(rows.value.map((row) => [row.routeName, { ...row } as MenuNode]));
  const roots: MenuNode[] = [];
  for (const node of nodes.values()) {
    const parent = node.parent ? nodes.get(node.parent) : undefined;
    if (parent) (parent.children ??= []).push(node);
    else roots.push(node);
  }
  const keyword = query.keyword.toLowerCase();
  function filter(nodes: MenuNode[]): MenuNode[] {
    return nodes
      .sort((a, b) => a.order - b.order)
      .flatMap((node) => {
        const matches = (node.title + ' ' + node.path).toLowerCase().includes(keyword);
        const children = node.children ? filter(node.children) : [];
        if (keyword && !matches && !children.length) return [];
        return [{ ...node, children: children.length ? children : undefined }];
      });
  }
  return filter(roots);
});
function expandAll(expanded: boolean) {
  function visit(nodes: MenuNode[]) {
    for (const node of nodes)
      if (node.children?.length) {
        table.value?.toggleRowExpansion(node, expanded);
        visit(node.children);
      }
  }
  visit(treeRows.value);
}
async function reorder({ source, target }: { source: MenuNode; target: MenuNode }) {
  if (
    savingOrder.value ||
    loading.value ||
    query.keyword ||
    !auth.can(PERMISSIONS.menuWrite) ||
    source.parent !== target.parent
  )
    return;
  const siblings = rows.value
    .filter((row) => row.parent === source.parent)
    .sort((a, b) => a.order - b.order);
  const from = siblings.findIndex((row) => row.routeName === source.routeName);
  const to = siblings.findIndex((row) => row.routeName === target.routeName);
  if (from < 0 || to < 0 || from === to) return;
  const [moved] = siblings.splice(from, 1);
  siblings.splice(to, 0, moved!);
  savingOrder.value = true;
  try {
    for (const [index, row] of siblings.entries()) {
      const order = index + 1;
      if (row.order !== order) {
        const { title, icon, visible, permissions, version } = row;
        await systemApi.saveMenu(row.routeName, {
          title,
          icon,
          visible,
          permissions,
          version,
          order,
        });
      }
    }
    ElMessage.success('菜单顺序已保存');
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '排序保存失败，请重试');
  } finally {
    await refresh();
    savingOrder.value = false;
  }
}
const keyword = shallowRef('');
function resetSearch() {
  keyword.value = '';
  search('');
}
const selected = shallowRef<MenuSetting | null>(null);
onDeactivated(() => {
  selected.value = null;
});
const columns: ColumnOptions<MenuNode>[] = [
  { type: 'selection', width: 48 },
  {
    key: 'tree-toggle',
    label: '',
    width: 40,
    align: 'center',
    className: 'app-tree-toggle-cell',
    cellSelectable: false,
  },
  { prop: 'title', label: '菜单名称', minWidth: 230, className: 'menu-name-column' },
  { prop: 'path', label: '页面地址', minWidth: 210 },
  { prop: 'order', label: '排序', width: 80 },
  { prop: 'visible', label: '显示', width: 100 },
  { prop: 'permissions', label: '访问权限', minWidth: 230 },
  {
    key: 'actions',
    cellSelectable: false,
    label: '操作',
    width: 100,
    fixed: 'right',
    align: 'center',
    className: 'app-action-cell',
  },
];
async function saved() {
  selected.value = null;
  ElMessage.success('菜单已保存');
  await refresh();
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
    <p class="system-notice">
      配置已有页面的导航入口。隐藏菜单不会撤销访问权限，访问权限需全部满足；系统入口保留必要权限。
    </p>
    <form
      class="system-search"
      @submit.prevent="search(keyword)"
    >
      <el-input
        v-model="keyword"
        aria-label="搜索菜单"
        placeholder="菜单名称或页面地址"
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
      table-key="system.menus"
      ref="menuTable"
      :rows="treeRows"
      :column-options="columns"
      :loading="loading || savingOrder"
      title="菜单列表"
      :table-options="{ rowKey: 'routeName', defaultExpandAll: true }"
      :row-draggable="auth.can(PERMISSIONS.menuWrite) && !query.keyword"
      :can-drop="(source, target) => source.parent === target.parent"
      @row-reorder="reorder"
    >
      <template #toolbar>
        <el-button @click="expandAll(true)">全部展开</el-button>
        <el-button @click="expandAll(false)">全部折叠</el-button>
        <el-button
          :disabled="loading || savingOrder"
          @click="reload"
        >
          刷新
        </el-button>
      </template>
      <template #cell-title="{ row }">
        <span
          class="menu-title"
          :style="{ paddingInlineStart: row.parent ? '16px' : '0' }"
        >
          <el-icon><component :is="menuIcon(row.icon)" /></el-icon>
          <span>{{ row.title }}</span>
        </span>
      </template>
      <template #cell-visible="{ row }">
        <el-tag :type="row.visible ? 'success' : 'info'">
          {{ row.visible ? '显示' : '隐藏' }}
        </el-tag>
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
            所有已登录用户
          </span>
        </div>
      </template>
      <template #cell-actions="{ row }">
        <el-button
          v-if="auth.can(PERMISSIONS.menuWrite)"
          link
          type="primary"
          :disabled="savingOrder"
          @click="selected = row"
        >
          编辑
        </el-button>
        <span
          v-else
          class="system-empty"
        >
          只读
        </span>
      </template>
    </AppTable>
    <MenuEditor
      v-if="selected"
      :menu="selected"
      :catalog="catalog"
      @close="selected = null"
      @saved="saved"
    />
  </div>
</template>

<style scoped src="./system.css"></style>

<style scoped>
:deep(.menu-name-column .cell) {
  white-space: nowrap;
}
.menu-title {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  vertical-align: middle;
}
</style>
