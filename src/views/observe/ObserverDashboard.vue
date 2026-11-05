<script setup lang="ts">
import { computed, shallowRef, watch } from 'vue';
import type { ObserverApi } from '@/api/xray';
import type { Node } from '@/api/xray/types';
import HostMetrics from './HostMetrics.vue';
import ObserverResources from './ObserverResources.vue';
import ObserverLogs from './ObserverLogs.vue';
import { formatTime } from './format';
import { useObserverQuery } from './useObserverQuery';

const props = defineProps<{ api: ObserverApi }>();
const selected = shallowRef('');
const { data, error, busy, refresh } = useObserverQuery(
  true,
  async (_key, signal) => {
    const overview = await props.api.overview(signal);
    const first = await props.api.nodes(1, signal);
    const nodes: Node[] = [...first.items];
    for (let page = 2; nodes.length < first.total; page++) {
      const next = await props.api.nodes(page, signal);
      if (!next.items.length) break;
      nodes.push(...next.items);
    }
    return { overview, nodes };
  },
  30000,
);
watch(data, (result) => {
  if (result && !result.nodes.some((node) => node.node_id === selected.value))
    selected.value = result.nodes[0]?.node_id || '';
});
const node = computed(() => data.value?.nodes.find((node) => node.node_id === selected.value));
const statusLabel = computed(
  () => ({ online: '在线', offline: '离线', unknown: '未知' })[node.value?.status || 'unknown'],
);
const cards = computed(() =>
  data.value
    ? [
        {
          label: '在线节点',
          value: `${data.value.overview.nodes_online} / ${data.value.overview.nodes_total}`,
        },
        { label: '入站', value: data.value.overview.inbounds_total },
        { label: '客户端', value: data.value.overview.clients_total },
        { label: '近 5 分钟活跃客户端', value: data.value.overview.active_clients_5m ?? '—' },
      ]
    : [],
);
</script>

<template>
  <section class="dashboard">
    <div class="heading-row">
      <div>
        <h1 class="title">运行概览</h1>
        <p class="muted">最近观测 {{ formatTime(data?.overview.observed_at_ms) }} · 每 30 秒刷新</p>
      </div>
      <el-button
        :loading="busy"
        @click="refresh"
      >
        刷新概览
      </el-button>
    </div>
    <el-alert
      v-if="error"
      :title="error"
      type="error"
      :closable="false"
      show-icon
    />
    <el-alert
      v-if="data?.overview.partial"
      title="部分节点数据不可用，概览仅反映已采集部分"
      type="warning"
      :closable="false"
    >
      <p
        v-for="item in data.overview.node_errors"
        :key="item.node_id"
      >
        {{ item.node_id }}：{{ item.message }}
      </p>
    </el-alert>
    <div class="summary-grid">
      <article
        v-for="card in cards"
        :key="card.label"
        class="summary-card"
      >
        <span class="muted">{{ card.label }}</span>
        <strong class="summary-value">{{ card.value }}</strong>
      </article>
    </div>
    <div class="node-bar">
      <label for="observe-node">观察节点</label>
      <el-select
        id="observe-node"
        v-model="selected"
        aria-label="观察节点"
        placeholder="暂无节点"
        class="node-select"
      >
        <el-option
          v-for="item in data?.nodes || []"
          :key="item.node_id"
          :label="item.name"
          :value="item.node_id"
        />
      </el-select>
      <template v-if="node">
        <el-tag
          :type="
            node.status === 'online' ? 'success' : node.status === 'offline' ? 'danger' : 'info'
          "
        >
          采集器{{ statusLabel }}
        </el-tag>
        <span class="muted">
          Xray：{{
            node.xray_running === null ? '未探测' : node.xray_running ? '运行中' : '已停止'
          }}
        </span>
        <span class="muted">最近心跳 {{ formatTime(node.last_seen_at_ms) }}</span>
      </template>
    </div>
    <p
      v-if="data && !node"
      class="muted"
    >
      暂无可观察节点，请检查后端节点配置。
    </p>
    <template v-if="node">
      <HostMetrics
        :key="`host:${selected}`"
        :api="api"
        :node="node"
      />
      <ObserverResources
        :key="`resources:${selected}`"
        :api="api"
        :node-id="selected"
      />
      <ObserverLogs
        :key="`logs:${selected}`"
        :api="api"
        :node="node"
      />
    </template>
  </section>
</template>

<style scoped>
.dashboard {
  display: grid;
  gap: 22px;
}
.heading-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
}
.title {
  margin: 0;
  font-size: 26px;
}
.muted {
  color: var(--app-color-text-secondary);
  font-size: 13px;
}
.summary-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
}
.summary-card {
  padding: 22px;
  background: var(--app-color-surface);
  border: 1px solid var(--app-color-border);
  border-radius: 12px;
}
.summary-value {
  display: block;
  font-size: 30px;
  font-weight: 600;
  margin-top: 12px;
  font-variant-numeric: tabular-nums;
}
.node-bar {
  display: flex;
  gap: 12px;
  align-items: center;
  flex-wrap: wrap;
}
.node-select {
  width: 220px;
}
.node-bar :deep(.el-tag) {
  flex-shrink: 0;
}
@media (max-width: 680px) {
  .summary-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 10px;
  }
  .summary-card {
    padding: 16px;
  }
}
</style>
