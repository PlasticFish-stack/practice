import { use } from 'echarts/core';
import { BarChart, GaugeChart, LineChart, PieChart } from 'echarts/charts';
import {
  AriaComponent,
  DataZoomComponent,
  DatasetComponent,
  GridComponent,
  LegendComponent,
  TooltipComponent,
} from 'echarts/components';
import { LabelLayout } from 'echarts/features';
import { SVGRenderer } from 'echarts/renderers';

// 新增图表种类时在这里注册，不在业务页面引入 ECharts 全量包。
use([
  LineChart,
  BarChart,
  PieChart,
  GaugeChart,
  GridComponent,
  LegendComponent,
  TooltipComponent,
  DatasetComponent,
  DataZoomComponent,
  AriaComponent,
  LabelLayout,
  SVGRenderer,
]);

export { init } from 'echarts/core';
export type {
  EChartsOption as ChartOption,
  EChartsType,
  ECElementEvent,
  SetOptionOpts,
} from 'echarts';
