<script setup lang="ts">
import { computed, shallowRef } from 'vue';
import { usePreferencesStore } from '@/stores/preferences';
import type { ObserverApi } from '@/api/xray';
import type { Node } from '@/api/xray/types';
import AppChart from '@/components/AppChart/AppChart.vue';
import type { ChartOption } from '@/components/AppChart/echarts';
import CoverageNotice from './CoverageNotice.vue';
import { byteRatio, formatBytes, formatRate, formatTime, metricRange, percent } from './format';
import { useObserverQuery } from './useObserverQuery';

const props = defineProps<{ api: ObserverApi; node: Node }>();
const minutes = shallowRef(60);
const preferences = usePreferencesStore();
const chartText = computed(() => (preferences.dark ? '#c5cad3' : '#5c6470'));
const chartGrid = computed(() => (preferences.dark ? '#303640' : '#edf0f3'));
const { data, busy, error, refresh } = useObserverQuery(
  () => (props.node.capabilities.host_metrics ? minutes.value : null),
  (duration, signal) =>
    props.api.host(props.node.node_id, metricRange(props.api.now(), duration), signal),
  60000,
);
const latest = computed(() => data.value?.points.filter((point) => point.sample_count > 0).at(-1));
const memory = computed(() =>
  byteRatio(latest.value?.memory_used_bytes, latest.value?.memory_total_bytes),
);
const disk = computed(() =>
  byteRatio(latest.value?.disk_used_bytes, latest.value?.disk_total_bytes),
);
const chart = computed<ChartOption>(() => ({
  tooltip: { trigger: 'axis', renderMode: 'richText' },
  legend: {
    data: ['CPU', '内存', '磁盘'],
    top: 0,
    bottom: 'auto',
    textStyle: { color: chartText.value },
  },
  grid: { left: 45, right: 22, top: 40, bottom: 32 },
  xAxis: {
    type: 'time',
    min: data.value?.range.from_ms,
    max: data.value?.range.to_ms,
    splitNumber: 4,
    axisLabel: { formatter: '{HH}:{mm}', hideOverlap: true, color: chartText.value },
  },
  yAxis: {
    type: 'value',
    min: 0,
    max: 100,
    axisLabel: { formatter: '{value}%', color: chartText.value },
    splitLine: { lineStyle: { color: chartGrid.value } },
  },
  series: ['CPU', '内存', '磁盘'].map((name, index) => ({
    name,
    type: 'line',
    showSymbol: false,
    connectNulls: false,
    data: (data.value?.points || []).map((point) => [
      point.observed_at_ms,
      point.sample_count === 0
        ? null
        : index === 0
          ? point.cpu_usage_ratio == null
            ? null
            : point.cpu_usage_ratio * 100
          : index === 1
            ? byteRatio(point.memory_used_bytes, point.memory_total_bytes)
            : byteRatio(point.disk_used_bytes, point.disk_total_bytes),
    ]),
  })),
}));
</script>

<template>
  <section
    class="panel"
    aria-labelledby="metrics-title"
  >
    <div class="panel-heading">
      <div>
        <h2
          id="metrics-title"
          class="panel-title"
        >
          主机指标
        </h2>
        <p class="muted">1 分钟聚合 · 图中断点表示缺少采样 · 每分钟刷新</p>
      </div>
      <div class="tools">
        <el-select
          v-model="minutes"
          aria-label="指标时间范围"
          class="range-select"
        >
          <el-option
            label="最近 1 小时"
            :value="60"
          />
          <el-option
            label="最近 6 小时"
            :value="360"
          />
          <el-option
            label="最近 24 小时"
            :value="1440"
          />
        </el-select>
        <el-button
          :loading="busy"
          :disabled="!node.capabilities.host_metrics"
          @click="refresh"
        >
          刷新指标
        </el-button>
      </div>
    </div>
    <p
      v-if="!node.capabilities.host_metrics"
      class="muted"
    >
      此节点未启用主机指标采集。
    </p>
    <template v-else>
      <p
        v-if="error"
        class="error"
        role="alert"
      >
        {{ error }}；已显示的历史结果可能已过期。
      </p>
      <div class="metric-cards">
        <div>
          <span class="muted">CPU</span>
          <strong>
            {{ percent(latest?.cpu_usage_ratio == null ? null : latest.cpu_usage_ratio * 100) }}
          </strong>
        </div>
        <div>
          <span class="muted">内存</span>
          <strong>{{ percent(memory) }}</strong>
          <small>
            {{ formatBytes(latest?.memory_used_bytes) }} /
            {{ formatBytes(latest?.memory_total_bytes) }}
          </small>
        </div>
        <div>
          <span class="muted">磁盘</span>
          <strong>{{ percent(disk) }}</strong>
          <small>
            {{ formatBytes(latest?.disk_used_bytes) }} / {{ formatBytes(latest?.disk_total_bytes) }}
          </small>
        </div>
        <div>
          <span class="muted">主机网络接收 / 发送</span>
          <strong class="network-value">
            {{ formatRate(latest?.network_rx_bytes_per_sec) }} /
            {{ formatRate(latest?.network_tx_bytes_per_sec) }}
          </strong>
          <small>包含容器网卡流量</small>
        </div>
      </div>
      <AppChart
        :option="chart"
        label="主机资源使用趋势"
        :height="210"
        :empty="!latest"
        :loading="busy && !data"
        empty-text="暂无采样数据，等待采集器生成指标"
      />
      <CoverageNotice
        v-if="data"
        :coverage="data.range.coverage"
      />
      <p class="muted">最近有效桶 {{ formatTime(latest?.observed_at_ms) }}</p>
    </template>
  </section>
</template>

<style scoped>
.panel {
  container-type: inline-size;
  padding: var(--app-space-md);
  border: 1px solid var(--app-color-border);
  border-radius: var(--app-radius-lg);
  background: var(--app-color-surface);
}
@container (max-width: 600px) {
  .metric-cards {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 14px;
  }
  .tools {
    flex-wrap: wrap;
  }
}
.panel-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}
.panel-title {
  margin: 0;
  font-size: 17px;
}
.muted {
  color: var(--app-color-text-secondary);
  font-size: 12px;
}
.tools {
  display: flex;
  gap: 10px;
}
.range-select {
  width: 145px;
}
.metric-cards {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 20px;
  margin: 20px 0;
}
.metric-cards strong {
  display: block;
  margin: 6px 0;
  font-size: 24px;
  font-weight: 500;
}
.metric-cards .network-value {
  font-size: 17px;
}
.metric-cards small {
  color: var(--app-color-text-secondary);
}
.error {
  color: var(--el-color-danger);
}
@media (max-width: 680px) {
  .panel {
    padding: 16px;
  }
  .metric-cards {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
