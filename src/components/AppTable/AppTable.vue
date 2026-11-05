<script setup lang="ts" generic="Row extends object">
import {
  computed,
  shallowRef,
  useTemplateRef,
  watch,
  nextTick,
  useAttrs,
  onBeforeUpdate,
  onBeforeUnmount,
  onDeactivated,
} from 'vue';
import type { TableInstance, TableColumnCtx } from 'element-plus';
import type {
  ColumnOptions,
  SelectedCell,
  SortChange,
  TableHandle,
  TableOptions,
  TablePagination,
  TableSlots,
} from './types';
import AppTableColumn from './AppTableColumn.vue';
import AppVirtualTable from './AppVirtualTable.vue';
import { virtualFallback } from './virtualMode';
import { useTableColumns } from './useTableColumns';
import TableColumnSettings from './TableColumnSettings.vue';
import { useCellSelection } from './useCellSelection';
import AppPagination from '@/components/AppPagination.vue';

defineOptions({ inheritAttrs: false });
const props = withDefaults(
  defineProps<{
    rows: Row[];
    columnOptions: readonly ColumnOptions<Row>[];
    loading?: boolean;
    tableOptions?: TableOptions<Row>;
    title?: string;
    description?: string;
    pagination?: TablePagination;
    cellSelection?: boolean;
    virtual?: boolean | 'auto';
    virtualThreshold?: number;
    virtualHeight?: number;
    rowDraggable?: boolean;
    dragColumn?: keyof Row & string;
    canDrop?: (source: Row, target: Row) => boolean;
    syncing?: boolean;
    columnSettings?: boolean;
    tableKey?: string;
  }>(),
  {
    loading: false,
    syncing: false,
    cellSelection: true,
    virtual: 'auto',
    virtualThreshold: 500,
    virtualHeight: 480,
    columnSettings: true,
  },
);
const slots = defineSlots<TableSlots<Row>>();
const columnState = useTableColumns(
  () => props.columnOptions,
  () => props.tableKey,
);
const effectiveColumns = computed(() =>
  props.columnSettings ? columnState.columns.value : props.columnOptions,
);
const settingsItems = computed(() => columnState.items.value);
const showSettings = computed(
  () => props.columnSettings && settingsItems.value.some((item) => !item.locked),
);
function resized(width: number, _oldWidth: number, column: TableColumnCtx<Row>) {
  if (props.columnSettings) columnState.resize(column.columnKey ?? column.property, width);
}
const emit = defineEmits<{
  'render-mode-change': [state: { mode: 'standard' | 'virtual'; reason?: string }];
  'cell-selection-change': [cells: SelectedCell[]];
  'row-reorder': [params: { source: Row; target: Row }];
  'selection-change': [rows: Row[]];
  'sort-change': [sort: SortChange<Row>];
  'row-click': [row: Row, column: unknown, event: Event];
  'page-change': [params: { page: number; pageSize: number }];
}>();
const table = useTemplateRef<TableInstance>('table');
const virtualTable = useTemplateRef<TableHandle<Row>>('virtualTable');
const attrs = useAttrs();
// useAttrs reflects updates but is not a reactive computed dependency.
const hasNativeAttrs = shallowRef(
  Object.keys(attrs).some((key) => !['class', 'style'].includes(key)),
);
onBeforeUpdate(() => {
  hasNativeAttrs.value = Object.keys(attrs).some((key) => !['class', 'style'].includes(key));
});
const fallback = computed(() => {
  const reason = virtualFallback(
    effectiveColumns.value,
    props.tableOptions ?? {},
    !!props.rowDraggable,
    !!slots.append,
    hasNativeAttrs.value,
  );
  if (reason) return reason;
  if (props.rows.some((row) => (row as Record<string, unknown>).children)) return 'tree-data';
  if (typeof props.tableOptions?.rowKey !== 'string') return 'row-key';
  const keys = props.rows.map(
    (row) => (row as Record<string, unknown>)[props.tableOptions!.rowKey as string],
  );
  if (
    keys.some((key) => typeof key !== 'string' && typeof key !== 'number') ||
    new Set(keys).size !== keys.length
  )
    return 'row-key';
  return undefined;
});
const isVirtual = computed(
  () =>
    props.virtual !== false &&
    !fallback.value &&
    (props.virtual === true ||
      (!props.pagination && props.rows.length >= Math.max(1, props.virtualThreshold))),
);
const renderHeight = computed(() => {
  const value = Number(
    props.tableOptions?.height ?? props.tableOptions?.maxHeight ?? props.virtualHeight,
  );
  return Number.isFinite(value) && value > 0 ? value : 480;
});
watch(
  [isVirtual, fallback],
  ([virtual, reason]) =>
    emit('render-mode-change', { mode: virtual ? 'virtual' : 'standard', reason }),
  { immediate: true },
);
const root = useTemplateRef<HTMLElement>('root');
const cells = useCellSelection(
  root,
  () => props.cellSelection && !props.loading && !isVirtual.value,
  (value) => emit('cell-selection-change', value),
);
watch(
  [
    () => props.rows,
    () => props.rows.length,
    effectiveColumns,
    () => props.cellSelection,
    () => props.loading,
  ],
  () => cells.clear(),
);
const selection = shallowRef<Row[]>([]);
function select(rows: Row[]) {
  selection.value = rows;
  emit('selection-change', rows);
}
// Virtual rows are recycled; reconcile selection against fresh data by identity.
watch([() => props.rows, () => props.rows.length, isVirtual], () => {
  if (!isVirtual.value || !selection.value.length) return;
  const key = props.tableOptions!.rowKey as keyof Row;
  const current = new Map(props.rows.map((row) => [row[key], row]));
  const reserve = props.columnOptions.some(
    (column) => column.type === 'selection' && column.reserveSelection,
  );
  const next = selection.value.flatMap((row) =>
    current.has(row[key]) ? [current.get(row[key])!] : reserve ? [row] : [],
  );
  if (
    next.length !== selection.value.length ||
    next.some((row, index) => row !== selection.value[index])
  )
    select(next);
});
const dragColumnKey = computed(
  () =>
    props.dragColumn ??
    effectiveColumns.value.find(
      (column) => column.prop && !column.hidden && (!column.type || column.type === 'default'),
    )?.prop,
);
const dragged = shallowRef<Row | null>(null);
const targetRow = shallowRef<Row | null>(null);
const dragRows = new WeakMap<HTMLElement, Row>();
function registerDragRow(element: HTMLElement, row: Row) {
  dragRows.set(element, row);
}
function rowFromEvent(event: DragEvent) {
  if (!(event.target instanceof Element)) return;
  const row = event.target.closest('.el-table__row');
  // Ignore headers, expanded detail tables and other nested table instances.
  if (row?.closest('.el-table') !== table.value?.$el) return;
  const marker = row?.querySelector<HTMLElement>('.row-drop-zone');
  return marker ? dragRows.get(marker) : undefined;
}
function rowClassName(scope: { row: Row; rowIndex: number }) {
  const configured = (attrs['row-class-name'] ??
    attrs.rowClassName ??
    props.tableOptions?.rowClassName) as TableOptions<Row>['rowClassName'];
  const custom = typeof configured === 'function' ? configured(scope) : configured;
  return [custom, targetRow.value === scope.row ? 'is-row-drop-target' : '']
    .filter(Boolean)
    .join(' ');
}
function endDrag() {
  dragged.value = targetRow.value = null;
}
onDeactivated(endDrag);
onBeforeUnmount(endDrag);
watch([() => props.rows, () => props.loading, () => props.rowDraggable], endDrag);
function startDrag(event: DragEvent, row: Row) {
  if (props.loading || !props.rowDraggable) {
    event.preventDefault();
    return;
  }
  cells.clear();
  dragged.value = row;
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', 'row');
  }
}
function canDropRow(row: Row | undefined): row is Row {
  return (
    !!dragged.value &&
    !!row &&
    props.rowDraggable &&
    !props.loading &&
    (dragged.value === row || props.canDrop?.(dragged.value, row) !== false)
  );
}
function overRow(event: DragEvent) {
  if (!dragged.value) return;
  const row = rowFromEvent(event);
  const allowed = canDropRow(row);
  event.preventDefault();
  if (event.dataTransfer) event.dataTransfer.dropEffect = allowed ? 'move' : 'none';
  targetRow.value = allowed && row !== dragged.value ? row : null;
}
function leaveRow(event: DragEvent) {
  if (!(event.relatedTarget instanceof Node) || !root.value?.contains(event.relatedTarget))
    targetRow.value = null;
}
function dropRow(event: DragEvent) {
  if (!dragged.value) return;
  event.preventDefault();
  const row = rowFromEvent(event);
  const source = dragged.value;
  const allowed = canDropRow(row);
  endDrag();
  if (allowed && row !== source) emit('row-reorder', { source, target: row });
}
watch(isVirtual, async () => {
  cells.clear();
  const selected = [...selection.value];
  await nextTick();
  if (!isVirtual.value) selected.forEach((row) => table.value?.toggleRowSelection(row, true));
});
defineExpose<TableHandle<Row>>({
  clearCellSelection: () =>
    isVirtual.value ? virtualTable.value?.clearCellSelection() : cells.clear(),
  getSelectedCells: () =>
    isVirtual.value ? (virtualTable.value?.getSelectedCells() ?? []) : cells.snapshot(),
  toggleRowExpansion: (row, expanded) => table.value?.toggleRowExpansion(row, expanded),
  clearSelection: () =>
    isVirtual.value ? virtualTable.value?.clearSelection() : table.value?.clearSelection(),
  getSelectionRows: () => selection.value,
  toggleRowSelection: (row, selected) =>
    isVirtual.value
      ? virtualTable.value?.toggleRowSelection(row, selected)
      : table.value?.toggleRowSelection(row, selected),
  clearSort: () => (isVirtual.value ? virtualTable.value?.clearSort() : table.value?.clearSort()),
});
</script>

<template>
  <section
    ref="root"
    class="app-table"
    :data-render-mode="isVirtual ? 'virtual' : 'standard'"
    :class="{ 'has-cell-selection': cellSelection, 'is-row-dragging': !!dragged }"
    :tabindex="cellSelection ? 0 : undefined"
    aria-label="数据表格"
    @mousedown="cells.down"
    @mouseover="cells.over"
    @keydown="cells.keydown"
    @copy="cells.copy"
    @dragenter="overRow"
    @dragover="overRow"
    @dragleave="leaveRow"
    @drop="dropRow"
  >
    <header
      v-if="title || slots.toolbar || showSettings"
      class="table-toolbar"
    >
      <div class="table-heading">
        <h2 v-if="title">{{ title }}</h2>
        <span v-if="description">{{ description }}</span>
      </div>
      <div class="table-tools">
        <slot
          name="toolbar"
          :selection="selection"
        />
        <TableColumnSettings
          v-if="showSettings"
          :items="settingsItems"
          :disabled="loading"
          @visibility="columnState.setVisible"
          @move="columnState.move"
          @reorder="columnState.moveTo"
          @resize="columnState.resize"
          @reset="columnState.reset"
        />
      </div>
    </header>
    <AppVirtualTable
      v-if="isVirtual"
      ref="virtualTable"
      :class="attrs.class"
      :style="attrs.style"
      v-loading="loading"
      :rows="rows"
      :columns="effectiveColumns"
      :options="tableOptions ?? {}"
      :cell-slots="slots"
      :loading="loading"
      :cell-selection="cellSelection"
      :height="renderHeight"
      :selected-rows="selection"
      :column-settings="columnSettings"
      @column-resize="columnState.resize"
      @selection-change="select"
      @cell-selection-change="emit('cell-selection-change', $event)"
      @sort-change="emit('sort-change', $event)"
      @row-click="(row, column, event) => emit('row-click', row, column, event)"
    >
      <template
        v-if="slots.empty"
        #empty
      >
        <slot name="empty" />
      </template>
    </AppVirtualTable>
    <el-table
      v-else
      ref="table"
      v-bind="{ ...tableOptions, ...$attrs }"
      v-loading="loading"
      :data="rows"
      :row-class-name="rowClassName"
      @selection-change="select"
      @header-dragend="resized"
      @expand-change="cells.clear()"
      @sort-change="
        (sort) => {
          cells.clear();
          emit('sort-change', sort);
        }
      "
      @row-click="(row, column, event) => emit('row-click', row, column, event)"
    >
      <AppTableColumn
        v-for="(column, index) in effectiveColumns"
        :key="column.key ?? column.prop ?? index"
        :column="column"
        :cell-slots="slots"
        :resize-column="
          columnSettings &&
          settingsItems.some((item) => item.id === (column.key ?? column.prop) && item.resizable)
            ? columnState.resize
            : undefined
        "
        :row-drag="
          rowDraggable && column.prop === dragColumnKey
            ? {
                disabled: loading,
                register: registerDragRow,
                start: startDrag,
                end: endDrag,
              }
            : undefined
        "
      />
      <template
        v-if="slots.empty"
        #empty
      >
        <slot name="empty" />
      </template>
      <template
        v-if="slots.append"
        #append
      >
        <slot name="append" />
      </template>
    </el-table>
    <footer
      v-if="pagination"
      class="table-pagination"
    >
      <AppPagination
        :current-page="pagination.page"
        :current-page-size="pagination.pageSize"
        :total="pagination.total"
        :syncing="syncing"
        :disabled="loading"
        @change="(params) => emit('page-change', params)"
      />
    </footer>
  </section>
</template>

<style scoped>
.app-table :deep(.row-drop-zone) {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  vertical-align: middle;
  border-radius: 4px;
}
.app-table :deep(.el-table__row.is-row-drop-target > td.el-table__cell) {
  background: var(--el-color-primary-light-9);
  box-shadow: inset 0 -2px var(--el-color-primary);
}
/* Native drag feedback belongs to the row, including padding and disabled controls. */
.app-table.is-row-dragging :deep(.el-table__row > td.el-table__cell > *) {
  pointer-events: none;
}
.app-table :deep(.row-drag-handle) {
  border: 0;
  background: transparent;
  color: var(--el-text-color-secondary);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  font-size: 16px;
  cursor: grab;
}
.app-table :deep(.row-drag-handle:hover) {
  color: var(--el-color-primary);
  background: var(--el-fill-color-light);
  border-radius: 4px;
}
.app-table :deep(.row-drag-handle:focus-visible) {
  outline: 2px solid var(--el-color-primary);
  outline-offset: 2px;
}
.app-table :deep(.row-drag-handle:active) {
  cursor: grabbing;
}
.app-table {
  min-width: 0;
  border: var(--app-border-secondary);
  background: var(--el-bg-color);
  border-radius: var(--app-radius-lg);
  box-shadow: none;
  overflow: hidden;
}
.table-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--app-space-md);
  padding: 16px 20px;
}
.table-heading {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: var(--app-space-sm);
}
.table-heading h2 {
  font-size: 16px;
  font-weight: 600;
  margin: 0;
}
.table-heading span {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}
.table-tools {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: var(--app-space-xs);
  align-items: center;
}
.table-pagination {
  padding: var(--app-space-md) var(--app-card-padding);
  display: flex;
  justify-content: flex-end;
  overflow-x: auto;
}
@media (max-width: 640px) {
  .table-toolbar {
    flex-wrap: wrap;
  }
  .table-tools {
    width: 100%;
    justify-content: flex-start;
  }
  .table-pagination {
    justify-content: flex-start;
  }
}
/* 表格密度与树形控件统一在封装内，small / large 仍沿用原生尺寸。 */
.app-table :deep(.el-table:not(.el-table--small):not(.el-table--large) .el-table__cell) {
  padding-block: 12px;
}
.app-table :deep(.el-table .cell) {
  line-height: 22px;
}
.app-table :deep(.el-table th.el-table__cell) {
  font-weight: 500;
}
.app-table :deep(.el-table th.el-table__cell:not(:last-child) > .cell::after) {
  content: '';
  position: absolute;
  right: 0;
  top: 50%;
  width: 1px;
  height: 16px;
  background: var(--el-border-color-lighter);
  transform: translateY(-50%);
}
.app-table :deep(.el-table__expand-icon) {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  margin-right: 8px;
  border: 1px solid var(--el-border-color);
  border-radius: 2px;
  box-sizing: border-box;
  vertical-align: middle;
  transform: none;
  background: var(--el-bg-color);
}
.app-table :deep(.el-table__expand-icon > .el-icon) {
  display: none;
}
.app-table :deep(.el-table__expand-icon::before),
.app-table :deep(.el-table__expand-icon::after) {
  content: '';
  position: absolute;
  width: 7px;
  height: 1px;
  background: var(--el-text-color-regular);
}
.app-table :deep(.el-table__expand-icon:not(.el-table__expand-icon--expanded)::after) {
  transform: rotate(90deg);
}
.app-table :deep(.el-table__expand-icon:hover) {
  border-color: var(--el-color-primary);
}
.app-table :deep(.el-table__placeholder) {
  width: 22px;
}
.table-tools :deep(.el-button + .el-button) {
  margin-left: 0;
}
.app-table :deep(.app-tree-toggle-cell .cell) {
  padding-inline: 8px;
}
.app-table :deep(.app-tree-toggle-cell .el-table__indent) {
  display: none;
}
.app-table :deep(.app-tree-toggle-cell .el-table__expand-icon) {
  margin: 0;
}
.app-table :deep(.app-action-cell) {
  border-left: 1px solid var(--el-table-border-color);
}
.app-table :deep(.el-table--scrollable-x .el-scrollbar) {
  padding-bottom: 12px;
  box-sizing: border-box;
}
.app-table :deep(.el-table--scrollable-x .el-scrollbar__bar.is-horizontal) {
  bottom: 3px;
}
.app-table.has-cell-selection {
  outline: none;
}
.has-cell-selection :deep(.el-table__body td:not(.app-cell-unselectable)) {
  user-select: none;
}
/* 选区背景优先于斑马纹、悬停及当前行背景，包含固定列。 */
.app-table :deep(.el-table .el-table__body td.el-table__cell.is-cell-selected) {
  background-color: var(--el-color-primary-light-9);
}
.app-table :deep(.el-table__body td.is-cell-active) {
  box-shadow: inset 0 0 0 1.5px var(--el-color-primary);
}
</style>
