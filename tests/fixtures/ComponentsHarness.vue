<script setup lang="ts">
import { computed, ref, shallowRef } from 'vue';
import { h } from 'vue';
import AppForm from '../../src/components/AppForm/AppForm.vue';
import AppTable from '../../src/components/AppTable/AppTable.vue';
import type { FormField } from '../../src/components/AppForm/types';
import type { ColumnOptions } from '../../src/components/AppTable/types';

type Model = {
  name: string;
  count: number;
  enabled: boolean;
  status: string;
  notes: string;
  date: string;
};
const initial = (): Model => ({
  name: '',
  count: 0,
  enabled: false,
  status: '',
  notes: '',
  date: '',
});
const model = ref(initial());
const submitted = shallowRef('');
const busy = shallowRef(false);
const fields = computed<FormField<Model>[]>(() => [
  {
    prop: 'name',
    label: '测试名称',
    type: 'input',
    rules: [{ required: true, message: '名称不能为空', trigger: 'blur' }],
  },
  { prop: 'count', label: '测试数量', type: 'number', props: { min: 0, max: 100 } },
  { prop: 'enabled', label: '显示备注', type: 'switch' },
  {
    prop: 'status',
    label: '测试状态',
    type: 'select',
    options: [
      { label: '在线', value: 'online' },
      { label: '离线', value: 'offline' },
    ],
  },
  { prop: 'notes', label: '测试备注', type: 'slot', visible: (value) => value.enabled },
  {
    prop: 'date',
    label: '测试日期',
    type: 'date',
    props: { valueFormat: 'YYYY-MM-DD', placeholder: '选择测试日期' },
  },
]);
interface Row {
  id: number;
  name: string;
  count: number;
}
const rows = ref<Row[]>([
  { id: 1, name: 'A', count: 0 },
  { id: 2, name: 'B', count: 2 },
]);
const lastSelection = shallowRef(0);
const sorted = shallowRef('');
const showCount = shallowRef(true);
const columns = computed<ColumnOptions<Row>[]>(() => [
  { type: 'selection', width: 48 },
  { type: 'expand', key: 'details', width: 48 },
  { type: 'index', label: '序号', width: 70 },
  {
    key: 'group',
    label: '基础信息',
    children: [
      { prop: 'id', label: '标识', sortable: true, width: 100, align: 'right' },
      {
        prop: 'name',
        label: '测试名称',
        minWidth: 150,
        filters: [{ text: 'A', value: 'A' }],
        slot: { 'filter-icon': () => h('span', { 'aria-label': '自定义筛选' }, '筛选') },
        render: ({ row }) => h('span', 'render-' + row.name),
      },
    ],
  },
  {
    key: 'metrics',
    label: '指标',
    children: [
      {
        prop: 'count',
        label: '数量',
        hidden: !showCount.value,
        edit: {
          type: 'number',
          onEdit(row, value) {
            if (value !== undefined) row.count = value;
          },
        },
      },
    ],
  },
  { key: 'actions', label: '测试操作' },
]);
</script>

<template>
  <div>
    <AppForm
      v-model="model"
      :fields="fields"
      :defaults="initial"
      :loading="busy"
      :columns="2"
      @submit="submitted = JSON.stringify($event)"
    >
      <template #field-notes="{ model: value, update, disabled }">
        <input
          aria-label="自定义备注"
          :value="value.notes"
          :disabled="disabled"
          @input="update(($event.target as HTMLInputElement).value)"
        />
      </template>
    </AppForm>
    <output aria-label="提交结果">{{ submitted }}</output>
    <el-button @click="busy = !busy">切换忙碌</el-button>
    <el-button @click="showCount = !showCount">切换数量列</el-button>
    <AppTable
      :rows="rows"
      :column-options="columns"
      :table-options="{ rowKey: 'id' }"
      title="测试表格"
      @selection-change="lastSelection = $event.length"
      @sort-change="sorted = String($event.order)"
    >
      <template #cell-details="{ row }">展开内容 {{ row.name }}</template>
      <template #cell-name="{ row }">slot-{{ row.name }}</template>
      <template #cell-actions="{ row }">
        <button @click="rows = rows.filter((item) => item.id !== row.id)">
          删除 {{ row.name }}
        </button>
      </template>
    </AppTable>
    <output aria-label="选择数量">{{ lastSelection }}</output>
    <output aria-label="排序状态">{{ sorted }}</output>
  </div>
</template>
