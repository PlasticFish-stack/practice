<script setup lang="ts">
import AppTable from '../../src/components/AppTable/AppTable.vue';
import type { ColumnOptions } from '../../src/components/AppTable/types';

type Row = { id: number; name: string; count: number; state: string };
const rows: Row[] = Array.from({ length: 4 }, (_, index) => ({
  id: index + 1,
  name: `条目 ${index + 1}`,
  count: index,
  state: '正常',
}));
const columns: ColumnOptions<Row>[] = [
  { prop: 'id', label: '编号' },
  { prop: 'name', label: '名称' },
  { prop: 'count', label: '数量' },
  { prop: 'state', label: '状态' },
];
</script>

<template>
  <AppTable
    title="测试条纹表格"
    :rows="rows"
    :column-options="columns"
    :column-settings="false"
    :table-options="{ stripe: true, rowKey: 'id' }"
  />
</template>
