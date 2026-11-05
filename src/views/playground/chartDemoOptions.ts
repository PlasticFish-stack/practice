import type { ChartOption } from '@/components/AppChart/echarts';

export function trendOption(points: number[]): ChartOption {
  return {
    aria: { enabled: true, description: '最近十二个采样点的 CPU 与内存使用率趋势，单位为百分比。' },
    tooltip: { trigger: 'axis' },
    legend: { bottom: 0, data: ['CPU', '内存'] },
    grid: { left: 12, right: 20, top: 24, bottom: 44, containLabel: true },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: points.map((_, i) => `14:${String(i * 5).padStart(2, '0')}`),
    },
    yAxis: { type: 'value', max: 100, axisLabel: { formatter: '{value}%' } },
    series: [
      {
        id: 'cpu',
        name: 'CPU',
        type: 'line',
        smooth: true,
        showSymbol: false,
        areaStyle: { opacity: 0.08 },
        data: points,
      },
      {
        id: 'memory',
        name: '内存',
        type: 'line',
        smooth: true,
        showSymbol: false,
        data: [42, 43, 44, 43, 45, 47, 46, 48, 47, 49, 48, 50],
      },
    ],
  };
}

export const trafficOption: ChartOption = {
  aria: { enabled: true, description: '四台演示主机的流入与流出流量对比，单位为 MB。' },
  tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
  legend: { bottom: 0 },
  grid: { left: 12, right: 16, top: 24, bottom: 44, containLabel: true },
  xAxis: { type: 'category', data: ['Node A', 'Node B', 'Node C', 'Node D'] },
  yAxis: { type: 'value', name: 'MB' },
  series: [
    {
      name: '流入',
      type: 'bar',
      barMaxWidth: 22,
      itemStyle: { borderRadius: [4, 4, 0, 0] },
      data: [86, 124, 68, 98],
    },
    {
      name: '流出',
      type: 'bar',
      barMaxWidth: 22,
      itemStyle: { borderRadius: [4, 4, 0, 0] },
      data: [62, 98, 45, 76],
    },
  ],
};

export const capacityOption: ChartOption = {
  aria: {
    enabled: true,
    description: '演示磁盘容量：应用 28 GB、日志 12 GB、备份 20 GB、可用 40 GB。',
  },
  tooltip: { trigger: 'item', valueFormatter: (value) => `${value} GB` },
  legend: { bottom: 0, itemWidth: 10, itemHeight: 10 },
  series: [
    {
      type: 'pie',
      radius: ['46%', '70%'],
      center: ['50%', '43%'],
      label: { show: false },
      itemStyle: { borderRadius: 4 },
      data: [
        { name: '应用', value: 28 },
        { name: '日志', value: 12 },
        { name: '备份', value: 20 },
        { name: '可用', value: 40 },
      ],
    },
  ],
};
