# 图表

入口：开发演示 → 图表演示（`/playground/charts`）。页面沿用 `playground:read` 权限，提供折线、柱形和环形示例，全部使用本地示例数据。

`components/AppChart/AppChart.vue` 管理 ECharts 实例、主题、容器尺寸和生命周期。数据请求、聚合、采样、刷新频率由页面处理，不由组件创建定时器或连接。

```vue
<script setup lang="ts">
import { computed, shallowRef } from 'vue';
import AppChart from '@/components/AppChart/AppChart.vue';
import type { ChartOption } from '@/components/AppChart/echarts';

const values = shallowRef([20, 35, 28]);
const loading = shallowRef(false);
const option = computed<ChartOption>(() => ({
  tooltip: { trigger: 'axis' },
  xAxis: { type: 'category', data: ['A', 'B', 'C'] },
  yAxis: { type: 'value' },
  series: [{ id: 'cpu', type: 'line', data: values.value }],
}));
</script>

<template>
  <AppChart
    :option="option"
    label="CPU 使用趋势"
    :height="300"
    :loading="loading"
    :empty="values.length === 0"
  />
</template>
```

- `option`：原生 ECharts 配置，保留 formatter、dataset、dataZoom 等能力。**用 computed 或替换对象更新**，不深度监听庞大的数据数组。
- 默认 `setOption({ notMerge: true })` 按完整配置更新，避免移除系列后残留旧图。需要保留图例、缩放等交互状态时，传 `:update-options="{ notMerge: false, replaceMerge: ['series'] }"`，并给系列设置稳定 `id`。
- `label`：必填的区域名称；可在 option 中配置 `aria`，描述图表含义和单位。
- `height`：数字（px）或 CSS 高度字符串，默认 300。百分比高度要求父容器有确定高度。
- 自动跟随全站明暗主题与 CSS 颜色变量，`dark` 可覆盖模式。通过 ECharts `setTheme` 更新配色，不销毁实例；业务 option 中显式写入的颜色优先于主题。
- `loading`、`empty`、`error`：由页面显式提供；优先级为加载 → 错误 → 空状态。`emptyText`、`empty` / `error` 插槽可定制展示。不会根据某一种 series 结构擅自判断空数据。
- `@click` 接收原生 `ECElementEvent`，用于点击钻取；`@ready` 提供实例；`@error` 通知渲染异常。组件 ref 提供 `resize()`、`getInstance()`；复杂事件和 `dispatchAction` 可通过实例接入。
- ResizeObserver 处理侧栏、卡片和窗口尺寸变化；零尺寸时延迟初始化。KeepAlive 停用后停止尺寸观察和配置更新，激活时应用最新配置并恢复尺寸，卸载时 dispose。页面自己的轮询仍需在停用时暂停。

使用 ECharts 6.1.0，默认 SVG 渲染。`echarts.ts` 集中按需注册折线、柱状、饼图、仪表盘，以及坐标轴、图例、提示、数据集、缩放和无障碍组件。新图种在该文件扩展注册；不要改成全量导入。图表代码随演示路由加载，未进入图表页面时不会初始化图表。

接监控接口时限制采样窗口和点数，并在页面转换成 option。不要把服务端提供的字符串当作 HTML formatter 执行，也不要把完整历史无限追加到浏览器内存。
