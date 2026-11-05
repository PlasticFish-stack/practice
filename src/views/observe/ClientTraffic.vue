<script setup lang="ts">
import { computed } from 'vue';
import { usePreferencesStore } from '@/stores/preferences';
import type { ObserverApi } from '@/api/xray';
import type { Client } from '@/api/xray/types';
import AppChart from '@/components/AppChart/AppChart.vue';
import type { ChartOption } from '@/components/AppChart/echarts';
import CoverageNotice from './CoverageNotice.vue';
import { formatBytes, metricRange } from './format';
import { useObserverQuery } from './useObserverQuery';

const props = defineProps<{ api: ObserverApi; client: Client }>();
const emit = defineEmits<{ close: [] }>();
const preferences = usePreferencesStore();
const chartText = computed(() => (preferences.dark ? '#c5cad3' : '#5c6470'));
const chartGrid = computed(() => (preferences.dark ? '#303640' : '#edf0f3'));
const { data, error, busy } = useObserverQuery(
  () => props.client.client_id,
  (id, signal) => props.api.traffic(props.client.node_id, id, metricRange(props.api.now()), signal),
  60000,
);
const chart = computed<ChartOption>(() => ({
  tooltip: { trigger: 'axis', renderMode: 'richText' },
  legend: { data: ['上行', '下行'], top: 0, bottom: 'auto', textStyle: { color: chartText.value } },
  grid: { left: 65, right: 20, top: 40, bottom: 32 },
  xAxis: {
    type: 'time',
    min: data.value?.range.from_ms,
    max: data.value?.range.to_ms,
    splitNumber: 4,
    axisLabel: { formatter: '{HH}:{mm}', hideOverlap: true, color: chartText.value },
  },
  yAxis: {
    type: 'value',
    name: '字节/秒',
    nameTextStyle: { color: chartText.value },
    axisLabel: { color: chartText.value },
    splitLine: { lineStyle: { color: chartGrid.value } },
  },
  series: (['up_bytes_per_sec', 'down_bytes_per_sec'] as const).map((field, index) => ({
    type: 'line',
    name: index ? '下行' : '上行',
    showSymbol: false,
    connectNulls: false,
    data: (data.value?.points || []).map((point) => [
      point.observed_at_ms,
      point.sample_count > 0 ? point[field] : null,
    ]),
  })),
}));
const empty = computed(
  () =>
    !data.value?.points.some(
      (point) => point.up_bytes_per_sec !== null || point.down_bytes_per_sec !== null,
    ),
);
</script>

<template>
  <div class="traffic-panel">
    <div class="traffic-heading">
      <strong>{{ client.label || client.client_id }} · 最近 1 小时流量</strong>
      <el-button
        text
        @click="emit('close')"
      >
        收起曲线
      </el-button>
    </div>
    <p
      v-if="error"
      class="error"
      role="alert"
    >
      {{ error }}
    </p>
    <p class="muted">
      累计上行 {{ formatBytes(data?.current?.up_bytes) }} / 下行
      {{ formatBytes(data?.current?.down_bytes) }}
      <span v-if="data?.current?.stale">· 计数已过期</span>
    </p>
    <AppChart
      :option="chart"
      label="客户端流量速率"
      :height="220"
      :loading="busy && !data"
      :empty="empty"
      empty-text="暂无有效速率，等待至少两个连续采样点"
    />
    <CoverageNotice
      v-if="data"
      :coverage="data.range.coverage"
    />
    <p class="muted">流量重置或采集器重启会中断计数连续性，相应时间桶留空。</p>
  </div>
</template>

<style scoped>
.traffic-panel {
  border: var(--app-border-secondary);
  border-radius: var(--app-radius-lg);
  padding: var(--app-space-lg);
  background: var(--app-color-surface);
}
.traffic-heading {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}
.muted {
  color: var(--app-color-text-secondary);
  font-size: 12px;
}
.error {
  color: var(--el-color-danger);
}
</style>
