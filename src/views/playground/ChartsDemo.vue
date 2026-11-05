<script setup lang="ts">
import { computed, shallowRef } from 'vue';
import type { ECElementEvent, SetOptionOpts } from '@/components/AppChart/echarts';
import AppChart from '@/components/AppChart/AppChart.vue';
import { capacityOption, trafficOption, trendOption } from './chartDemoOptions';

type State = 'normal' | 'loading' | 'empty' | 'error';
const state = shallowRef<State>('normal');
const revision = shallowRef(0);
const updateOptions: SetOptionOpts = { notMerge: false, replaceMerge: ['series'] };
const selected = shallowRef('点击柱形或环形数据查看详情');
const initial = [24, 32, 28, 46, 38, 52, 41, 36, 58, 43, 35, 48];
const trend = computed(() =>
  trendOption(initial.map((value, i) => Math.min(95, value + ((revision.value * 7 + i) % 17)))),
);
function updateData() {
  revision.value++;
}
function selectData(event: ECElementEvent) {
  selected.value = `${event.seriesName || '磁盘容量'} · ${event.name}：${event.value}`;
}
</script>

<template>
  <section class="charts-demo">
    <div class="chart-intro">
      <div>
        <h2>图表演示</h2>
        <p>趋势、对比与占比，统一主题和交互。以下均为本地示例数据。</p>
      </div>
      <el-tag type="info">示例数据</el-tag>
    </div>
    <div class="demo-toolbar">
      <el-radio-group
        v-model="state"
        aria-label="图表状态"
      >
        <el-radio-button value="normal">正常</el-radio-button>
        <el-radio-button value="loading">加载中</el-radio-button>
        <el-radio-button value="empty">空数据</el-radio-button>
        <el-radio-button value="error">加载失败</el-radio-button>
      </el-radio-group>
      <el-button @click="updateData">更新示例数据</el-button>
    </div>
    <article class="chart-card">
      <div class="card-heading">
        <div>
          <h3>资源使用趋势</h3>
          <p>最近 1 小时 · 5 分钟采样</p>
        </div>
        <span class="sample-version">数据版本 {{ revision + 1 }}</span>
      </div>
      <AppChart
        :option="trend"
        :update-options="updateOptions"
        label="资源使用趋势"
        :height="320"
        :loading="state === 'loading'"
        :empty="state === 'empty'"
        :error="state === 'error' ? '数据加载失败，请稍后重试' : ''"
      />
    </article>
    <div class="chart-grid">
      <article class="chart-card">
        <div class="card-heading">
          <div>
            <h3>主机流量对比</h3>
            <p>流入 / 流出 · MB</p>
          </div>
        </div>
        <AppChart
          :option="trafficOption"
          label="主机流量对比"
          @click="selectData"
        />
      </article>
      <article class="chart-card">
        <div class="card-heading">
          <div>
            <h3>磁盘容量分布</h3>
            <p>总容量 100 GB</p>
          </div>
        </div>
        <AppChart
          :option="capacityOption"
          label="磁盘容量分布"
          @click="selectData"
        />
      </article>
    </div>
    <p
      class="selection-hint"
      aria-live="polite"
    >
      {{ selected }}
    </p>
  </section>
</template>

<style scoped>
.charts-demo {
  display: grid;
  gap: var(--app-space-md);
  min-width: 0;
}
.chart-intro,
.demo-toolbar,
.card-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--app-space-md);
  flex-wrap: wrap;
}
h2,
h3,
p {
  margin: 0;
}
h2 {
  font-size: 22px;
}
h3 {
  font-size: 16px;
  font-weight: 600;
}
.chart-intro p,
.card-heading p {
  margin-top: 8px;
  color: var(--app-color-text-secondary);
  font-size: 13px;
}
.chart-card {
  padding: var(--app-card-padding);
  border: var(--app-border-secondary);
  border-radius: var(--app-radius-lg);
  background: var(--app-color-surface);
  min-width: 0;
}
.card-heading {
  margin-bottom: var(--app-space-md);
}
.sample-version,
.selection-hint {
  font-size: 13px;
  color: var(--app-color-text-tertiary);
}
.chart-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr);
  gap: var(--app-space-md);
}
@media (max-width: 900px) {
  .chart-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
@media (max-width: 480px) {
  .chart-card {
    padding: var(--app-space-md);
  }
}
</style>
