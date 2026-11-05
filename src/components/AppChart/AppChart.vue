<script setup lang="ts">
import {
  computed,
  onActivated,
  onBeforeUnmount,
  onDeactivated,
  onMounted,
  shallowRef,
  useTemplateRef,
  watch,
} from 'vue';
import { usePreferencesStore } from '@/stores/preferences';
import { chartTheme } from './chartTheme';
import {
  init,
  type ChartOption,
  type EChartsType,
  type ECElementEvent,
  type SetOptionOpts,
} from './echarts';

const props = withDefaults(
  defineProps<{
    option: ChartOption;
    label: string;
    height?: number | string;
    loading?: boolean;
    empty?: boolean;
    error?: string;
    emptyText?: string;
    dark?: boolean;
    updateOptions?: SetOptionOpts;
  }>(),
  {
    height: 300,
    emptyText: '暂无数据',
  },
);
const emit = defineEmits<{
  ready: [chart: EChartsType];
  click: [event: ECElementEvent];
  error: [error: unknown];
}>();
const preferences = usePreferencesStore();
const host = useTemplateRef<HTMLElement>('host');
const dark = computed(() => props.dark ?? preferences.dark);
const failed = shallowRef(false);
const message = computed(() => props.error || (failed.value ? '图表渲染失败' : ''));
const height = computed(() =>
  typeof props.height === 'number' ? `${props.height}px` : props.height,
);
let chart: EChartsType | undefined;
let observer: ResizeObserver | undefined;
let frame = 0;
let active = true;
let disposed = false;
let dirty = true;
let themeDirty = true;

function render() {
  const element = host.value;
  if (!active || disposed || !element || element.clientWidth < 1 || element.clientHeight < 1)
    return;
  try {
    if (!chart) {
      chart = init(element, chartTheme(element, dark.value), { renderer: 'svg' });
      chart.on('click', (event) => emit('click', event));
      emit('ready', chart);
      themeDirty = false;
    }
    if (themeDirty) {
      chart.setTheme(chartTheme(element, dark.value));
      themeDirty = false;
    }
    if (dirty) {
      chart.setOption(props.option, { notMerge: true, ...props.updateOptions });
      dirty = false;
      failed.value = false;
    }
    chart.resize();
  } catch (error) {
    failed.value = true;
    emit('error', error);
  }
}
function resize() {
  cancelAnimationFrame(frame);
  if (active && !disposed) frame = requestAnimationFrame(render);
}
watch(
  () => [props.option, props.updateOptions],
  () => {
    dirty = true;
    resize();
  },
);
watch(dark, () => {
  themeDirty = true;
  resize();
});
onMounted(() => {
  observer = new ResizeObserver(resize);
  if (host.value) observer.observe(host.value);
  resize();
  void document.fonts.ready.then(resize);
});
onActivated(() => {
  active = true;
  if (host.value) observer?.observe(host.value);
  resize();
});
onDeactivated(() => {
  active = false;
  cancelAnimationFrame(frame);
  observer?.disconnect();
});
onBeforeUnmount(() => {
  disposed = true;
  cancelAnimationFrame(frame);
  observer?.disconnect();
  chart?.dispose();
  chart = undefined;
});
defineExpose({ resize, getInstance: () => chart });
</script>

<template>
  <section
    class="app-chart"
    :aria-label="label"
    :aria-busy="loading"
    :style="{ height }"
  >
    <div
      ref="host"
      class="chart-host"
      :class="{ 'is-hidden': empty || message }"
      :aria-hidden="empty || !!message"
    />
    <div
      v-if="loading"
      class="chart-state chart-loading"
      role="status"
    >
      <span class="loading-dot" />
      加载中…
    </div>
    <div
      v-else-if="message"
      class="chart-state"
      role="alert"
    >
      <slot
        name="error"
        :message="message"
      >
        {{ message }}
      </slot>
    </div>
    <div
      v-else-if="empty"
      class="chart-state"
      role="status"
    >
      <slot name="empty">{{ emptyText }}</slot>
    </div>
  </section>
</template>

<style scoped>
.app-chart {
  position: relative;
  width: 100%;
  min-width: 0;
}
.chart-host {
  width: 100%;
  height: 100%;
}
.is-hidden {
  visibility: hidden;
}
.chart-state {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: var(--app-color-text-secondary);
  background: var(--app-color-surface);
}
.chart-loading {
  background: var(--app-color-loading-mask);
}
.loading-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--app-color-primary);
}
</style>
