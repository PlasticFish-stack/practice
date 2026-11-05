<script setup lang="ts">
import {
  computed,
  nextTick,
  onActivated,
  onDeactivated,
  onScopeDispose,
  ref,
  shallowRef,
} from 'vue';
import { GetDevices } from '@/api/device';
import { Refresh } from '@element-plus/icons-vue';
import { useAuthStore } from '@/stores/auth';
import { PERMISSIONS } from '@/auth/permissions';
import type { Device, DeviceSearch } from '@/types/device';
import type { ColumnOptions } from '@/components/AppTable/types';
import DeviceSearchForm from './components/DeviceSearch.vue';
import DeviceEditDialog from './components/DeviceEditDialog.vue';
import AppTable from '@/components/AppTable/AppTable.vue';
import StatusIndicator from '@/components/StatusIndicator.vue';

const auth = useAuthStore();
const deviceList = ref<Device[]>([]);
const currentPage = shallowRef(1);
const currentPageSize = shallowRef(10);
const total = shallowRef(0);
const syncing = shallowRef(false);
const tableLoading = shallowRef(false);
const error = shallowRef('');
const editing = shallowRef<Device | null>(null);
const editorOpen = shallowRef(false);
let activeSearch: DeviceSearch = {};
let requestCount = 0;
let controller: AbortController | null = null;
let active = true;
let activated = false;

function editDevice(row: Device) {
  if (!auth.can(PERMISSIONS.deviceUpdate)) return;
  editing.value = row;
  editorOpen.value = true;
}

const tableColumnOptions = computed<ColumnOptions<Device>[]>(() => [
  { prop: 'id', label: 'ID', width: 80 },
  { prop: 'name', label: '名称', minWidth: 160, showOverflowTooltip: true },
  { prop: 'workshopId', label: '车间' },
  { prop: 'status', label: '状态', width: 100 },
  { prop: 'brightness', label: '亮度' },
  { prop: 'temperature', label: '温度' },
  { prop: 'version', label: '版本' },
  { prop: 'updatedAt', label: '更新时间', minWidth: 220, showOverflowTooltip: true },
  ...(auth.can(PERMISSIONS.deviceUpdate)
    ? [{ key: 'actions', label: '操作', width: 100, fixed: 'right' as const }]
    : []),
]);

function searchDevices(params: DeviceSearch) {
  activeSearch = params;
  return getDevices({ page: 1 });
}

async function getDevices(params: DeviceSearch = {}) {
  if (!active) return;
  const sequence = ++requestCount;
  controller?.abort();
  controller = new AbortController();
  tableLoading.value = true;
  error.value = '';
  try {
    const { data } = await GetDevices(
      { ...activeSearch, page: currentPage.value, pageSize: currentPageSize.value, ...params },
      controller.signal,
    );
    if (sequence !== requestCount) return;
    syncing.value = true;
    deviceList.value = data.list;
    total.value = data.total;
    currentPage.value = data.page;
    currentPageSize.value = data.pageSize;
    await nextTick();
  } catch (cause) {
    if (sequence === requestCount)
      error.value = cause instanceof Error ? cause.message : '设备加载失败';
  } finally {
    if (sequence === requestCount) {
      syncing.value = false;
      tableLoading.value = false;
    }
  }
}

onScopeDispose(() => {
  requestCount++;
  controller?.abort();
});
onDeactivated(() => {
  active = false;
  requestCount++;
  controller?.abort();
  syncing.value = false;
  tableLoading.value = false;
  editorOpen.value = false;
});
onActivated(() => {
  active = true;
  if (activated) void getDevices();
  activated = true;
});
void getDevices();
</script>

<template>
  <div>
    <DeviceSearchForm @search="searchDevices" />
    <el-alert
      v-if="error"
      :title="error"
      type="error"
      :closable="false"
      show-icon
      role="alert"
    />
    <AppTable
      table-key="devices.list"
      :column-options="tableColumnOptions"
      :rows="deviceList"
      :loading="tableLoading"
      :table-options="{ stripe: true, rowKey: 'id' }"
      title="设备列表"
      :description="`共 ${total} 台设备`"
      :pagination="{ page: currentPage, pageSize: currentPageSize, total }"
      :syncing="syncing"
      @page-change="getDevices"
    >
      <template #toolbar>
        <el-button
          :disabled="tableLoading"
          @click="getDevices()"
        >
          <el-icon><Refresh /></el-icon>
          刷新
        </el-button>
      </template>
      <template #cell-status="{ row }">
        <StatusIndicator
          :color="
            row.status === 'online'
              ? 'var(--app-color-success)'
              : row.status === 'offline'
                ? 'var(--app-color-warning)'
                : 'var(--app-color-danger)'
          "
          :ripple="row.status === 'error'"
        />
      </template>
      <template #cell-actions="{ row }">
        <el-button
          v-if="auth.can(PERMISSIONS.deviceUpdate)"
          link
          type="primary"
          @click="editDevice(row)"
        >
          编辑
        </el-button>
      </template>
    </AppTable>
    <DeviceEditDialog
      v-if="auth.can(PERMISSIONS.deviceUpdate)"
      v-model="editorOpen"
      :device="editing"
      @saved="getDevices()"
    />
  </div>
</template>
