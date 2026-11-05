<script setup lang="ts">
import { shallowRef, watch } from 'vue';
import type { ObserverApi } from '@/api/xray';
import type { Client, Inbound } from '@/api/xray/types';
import AppTable from '@/components/AppTable/AppTable.vue';
import type { ColumnOptions } from '@/components/AppTable/types';
import ClientTraffic from './ClientTraffic.vue';
import { formatBytes } from './format';
import { useObserverQuery } from './useObserverQuery';

const props = defineProps<{ api: ObserverApi; nodeId: string }>();
const inboundPage = shallowRef({ page: 1, pageSize: 20 });
const clientPage = shallowRef({ page: 1, pageSize: 20 });
const inboundTotal = shallowRef(0);
const clientTotal = shallowRef(0);
const selectedClient = shallowRef<Client | null>(null);
const inbounds = useObserverQuery(
  inboundPage,
  (query, signal) => props.api.inbounds(props.nodeId, query.page, signal, query.pageSize),
  60000,
);
const clients = useObserverQuery(
  clientPage,
  (query, signal) => props.api.clients(props.nodeId, query.page, signal, query.pageSize),
  60000,
);
watch(inbounds.data, (value) => {
  if (value) inboundTotal.value = value.total;
});
watch(clients.data, (value) => {
  if (value) clientTotal.value = value.total;
});
function changeClients(query: { page: number; pageSize: number }) {
  selectedClient.value = null;
  clientPage.value = query;
}
const inboundColumns: ColumnOptions<Inbound>[] = [
  { prop: 'tag', label: '入站', minWidth: 150 },
  { prop: 'protocol', label: '协议', width: 100 },
  { prop: 'port', label: '端口', width: 90 },
  { prop: 'enabled', label: '启用', width: 90, formatter: (row) => (row.enabled ? '是' : '否') },
  { prop: 'client_count', label: '客户端', width: 100 },
  {
    key: 'traffic',
    label: '累计流量',
    minWidth: 160,
    formatter: (row) =>
      `${formatBytes(row.traffic?.total_bytes)}${row.traffic?.stale ? '（已过期）' : ''}`,
  },
];
const clientColumns: ColumnOptions<Client>[] = [
  { key: 'label', label: '客户端', minWidth: 160, formatter: (row) => row.label || row.client_id },
  {
    prop: 'enabled',
    label: '启用状态',
    width: 100,
    formatter: (row) => (row.enabled === null ? '未知' : row.enabled ? '启用' : '停用'),
  },
  {
    prop: 'active_recent',
    label: '近 5 分钟',
    width: 100,
    formatter: (row) =>
      row.active_recent === null ? '未知' : row.active_recent ? '有活动' : '无活动',
  },
  {
    key: 'traffic',
    label: '累计上行 / 下行',
    minWidth: 190,
    formatter: (row) =>
      `${formatBytes(row.traffic?.up_bytes)} / ${formatBytes(row.traffic?.down_bytes)}${row.traffic?.stale ? '（已过期）' : ''}`,
  },
  {
    prop: 'quota_bytes',
    label: '流量配额',
    minWidth: 120,
    formatter: (row) => (row.quota_bytes === null ? '无限或未知' : formatBytes(row.quota_bytes)),
  },
  { key: 'actions', label: '操作', width: 110, fixed: 'right', cellSelectable: false },
];
</script>

<template>
  <section
    class="resource-section"
    aria-label="入站与客户端"
  >
    <el-alert
      v-if="inbounds.error.value"
      :title="inbounds.error.value"
      type="error"
      :closable="false"
    />
    <AppTable
      table-key="observe.inbounds"
      :rows="inbounds.data.value?.items || []"
      :column-options="inboundColumns"
      :loading="inbounds.busy.value"
      :table-options="{ rowKey: 'inbound_id', stripe: true }"
      title="入站"
      :description="`共 ${inboundTotal} 个`"
      :pagination="{ ...inboundPage, total: inboundTotal }"
      @page-change="inboundPage = $event"
    >
      <template #toolbar>
        <el-button
          :loading="inbounds.busy.value"
          @click="inbounds.refresh"
        >
          刷新入站
        </el-button>
      </template>
      <template #empty>暂无采集到的入站</template>
    </AppTable>
    <el-alert
      v-if="clients.error.value"
      :title="clients.error.value"
      type="error"
      :closable="false"
    />
    <AppTable
      table-key="observe.clients"
      :rows="clients.data.value?.items || []"
      :column-options="clientColumns"
      :loading="clients.busy.value"
      :table-options="{ rowKey: 'client_id', stripe: true }"
      title="客户端"
      :description="`共 ${clientTotal} 个`"
      :pagination="{ ...clientPage, total: clientTotal }"
      @page-change="changeClients"
    >
      <template #toolbar>
        <el-button
          :loading="clients.busy.value"
          @click="clients.refresh"
        >
          刷新客户端
        </el-button>
      </template>
      <template #empty>暂无采集到的客户端</template>
      <template #cell-label="{ row }">
        <el-tooltip
          :content="row.client_id"
          placement="top"
        >
          <span class="client-label">{{ row.label || row.client_id }}</span>
        </el-tooltip>
      </template>
      <template #cell-actions="{ row }">
        <el-button
          link
          type="primary"
          @click="selectedClient = row"
        >
          查看曲线
        </el-button>
      </template>
    </AppTable>
    <ClientTraffic
      v-if="selectedClient"
      :key="selectedClient.client_id"
      :api="api"
      :client="selectedClient"
      @close="selectedClient = null"
    />
  </section>
</template>

<style scoped>
.client-label {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.resource-section {
  display: grid;
  gap: var(--app-space-lg);
  min-width: 0;
}
</style>
