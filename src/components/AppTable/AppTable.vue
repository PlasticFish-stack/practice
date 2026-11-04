<script setup lang="ts" generic="Row extends object">
import { shallowRef, useTemplateRef } from 'vue'
import type { TableInstance } from 'element-plus'
import type { ColumnOptions, SortChange, TableHandle, TableOptions, TablePagination, TableSlots } from './types'
import AppTableColumn from './AppTableColumn.vue'
import AppPagination from '@/components/AppPagination.vue'

defineOptions({ inheritAttrs: false })
withDefaults(defineProps<{
  rows: Row[]
  columnOptions: readonly ColumnOptions<Row>[]
  loading?: boolean
  tableOptions?: TableOptions<Row>
  title?: string
  description?: string
  pagination?: TablePagination
  syncing?: boolean
}>(), { loading: false, syncing: false })
const slots = defineSlots<TableSlots<Row>>()
const emit = defineEmits<{
  'selection-change': [rows: Row[]]
  'sort-change': [sort: SortChange<Row>]
  'row-click': [row: Row, column: unknown, event: Event]
  'page-change': [params: { page: number; pageSize: number }]
}>()
const table = useTemplateRef<TableInstance>('table')
const selection = shallowRef<Row[]>([])
function select(rows: Row[]) { selection.value = rows; emit('selection-change', rows) }
defineExpose<TableHandle<Row>>({
  clearSelection: () => table.value?.clearSelection(),
  getSelectionRows: () => table.value?.getSelectionRows() ?? [],
  toggleRowSelection: (row, selected) => table.value?.toggleRowSelection(row, selected),
  clearSort: () => table.value?.clearSort(),
})
</script>

<template>
  <section class="app-table">
    <header v-if="title || slots.toolbar" class="table-toolbar">
      <div class="table-heading"><h2 v-if="title">{{ title }}</h2><span v-if="description">{{ description }}</span></div>
      <div class="table-tools"><slot name="toolbar" :selection="selection" /></div>
    </header>
    <el-table ref="table" v-bind="{ ...tableOptions, ...$attrs }" v-loading="loading" :data="rows" @selection-change="select"
      @sort-change="sort => emit('sort-change', sort)" @row-click="(row, column, event) => emit('row-click', row, column, event)">
      <AppTableColumn v-for="(column, index) in columnOptions" :key="column.key ?? column.prop ?? index" :column="column" :cell-slots="slots" />
      <template v-if="slots.empty" #empty><slot name="empty" /></template>
      <template v-if="slots.append" #append><slot name="append" /></template>
    </el-table>
    <footer v-if="pagination" class="table-pagination">
      <AppPagination :current-page="pagination.page" :current-page-size="pagination.pageSize" :total="pagination.total" :syncing="syncing"
        :disabled="loading" @change="params => emit('page-change', params)" />
    </footer>
  </section>
</template>

<style scoped>
.app-table { min-width: 0; border: var(--app-border-secondary); background: var(--el-bg-color); border-radius: var(--app-radius-lg); box-shadow: var(--app-shadow-card); overflow: hidden; }
.table-toolbar { display: flex; align-items: center; justify-content: space-between; gap: var(--app-space-md); padding: var(--app-card-padding); }
.table-heading { display: flex; align-items: baseline; flex-wrap: wrap; gap: var(--app-space-sm); }
.table-heading h2 { font-size: 16px; font-weight: 600; margin: 0; }
.table-heading span { color: var(--el-text-color-secondary); font-size: 12px; }
.table-tools { display: flex; gap: var(--app-space-xs); align-items: center; }
.table-pagination { padding: var(--app-space-md) var(--app-card-padding); display: flex; justify-content: flex-end; overflow-x: auto; }
@media (max-width: 640px) { .table-toolbar { flex-wrap: wrap; } .table-pagination { justify-content: flex-start; } }
</style>
