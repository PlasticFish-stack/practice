<script setup lang="ts" generic="Row extends object">
import { computed, h, onBeforeUnmount, onMounted, shallowRef, useTemplateRef, watch, type VNodeChild } from 'vue'
import { ElAutoResizer, ElCheckbox, ElTableV2, TableV2SortOrder, type Column, type TableColumnCtx } from 'element-plus'
import 'element-plus/es/components/table-v2/style/css'
import ColumnResizeHandle from './ColumnResizeHandle.vue'
import type { CellScope, ColumnOptions, SelectedCell, SortChange, TableCellSlots, TableHandle, TableOptions } from './types'

const props = defineProps<{ rows: Row[]; columns: readonly ColumnOptions<Row>[]; options: TableOptions<Row>; cellSlots: TableCellSlots<Row>; loading: boolean; cellSelection: boolean; height: number; selectedRows: Row[]; columnSettings?: boolean }>()
const emit = defineEmits<{ 'column-resize': [id: string, width: number]; 'selection-change': [rows: Row[]]; 'cell-selection-change': [cells: SelectedCell[]]; 'sort-change': [sort: SortChange<Row>]; 'row-click': [row: Row, column: unknown, event: Event] }>()
const root = useTemplateRef<HTMLElement>('root')
const table = useTemplateRef<{ scrollToRow: (row: number) => void }>('table')
const columns = computed(() => props.columns.filter(column => !column.hidden))
const columnKey = (column: ColumnOptions<Row>) => column.key ?? column.prop
const sort = shallowRef<{ key: string; order: TableV2SortOrder }>()
const sortBy = computed(() => sort.value && columns.value.some(column => columnKey(column) === sort.value!.key) ? sort.value : undefined)
const data = computed(() => {
  const current = sortBy.value, column = current && columns.value.find(column => columnKey(column) === current.key)
  if (!current || !column?.prop || column.sortable === 'custom') return props.rows
  const prop = column.prop
  return [...props.rows].sort((a, b) => {
    const left = a[prop], right = b[prop]
    const result = typeof left === 'number' && typeof right === 'number' ? left - right : String(left ?? '').localeCompare(String(right ?? ''), undefined, { numeric: true })
    return current.order === 'asc' ? result : -result
  })
})
function key(row: Row) {
  const rowKey = props.options.rowKey
  return typeof rowKey === 'function' ? rowKey(row) : rowKey ? (row as Record<string, unknown>)[rowKey] : row
}
const selectedKeys = computed(() => new Set(props.selectedRows.map(key)))
const rowIndexes = computed(() => new Map(props.rows.map((row, index) => [row, index])))
function checked(row: Row) { return selectedKeys.value.has(key(row)) }
function selectable(row: Row) {
  const column = columns.value.find(column => column.type === 'selection')
  return !column?.selectable || column.selectable(row, rowIndexes.value.get(row) ?? -1)
}
function toggle(row: Row, value = !checked(row)) {
  if (!selectable(row)) return
  emit('selection-change', value ? checked(row) ? props.selectedRows : [...props.selectedRows, row] : props.selectedRows.filter(item => key(item) !== key(row)))
}
function scope(row: Row, index: number, column: ColumnOptions<Row>): CellScope<Row> {
  return { row, $index: index, column: { ...column, property: column.prop } as unknown as TableColumnCtx<Row> }
}
function renderCell(row: Row, rowIndex: number, column: ColumnOptions<Row>): VNodeChild {
  if (column.type === 'index') return typeof column.index === 'function' ? column.index(rowIndex) : rowIndex + (typeof column.index === 'number' ? column.index : 1)
  const renderer = props.cellSlots[`cell-${column.key ?? column.prop}`] ?? column.render ?? column.slot?.default
  const cell = scope(row, rowIndex, column)
  if (renderer) return renderer(cell)
  const value = column.prop ? row[column.prop] : ''
  return column.formatter ? column.formatter(row, cell.column, value, rowIndex) : String(value ?? '')
}
type Point = { row: number; column: number }
const anchor = shallowRef<Point>(), active = shallowRef<Point>()
let dragging = false
const interactive = 'button,a,input,textarea,select,[contenteditable],.el-checkbox,.el-switch,[role="button"]'
const eligible = (index: number) => { const column = columns.value[index]; return column && !column.type?.match(/selection|index|expand/) && column.cellSelectable !== false }
function contains(row: number, column: number) {
  return !!(anchor.value && active.value && eligible(column) && row >= Math.min(anchor.value.row, active.value.row) && row <= Math.max(anchor.value.row, active.value.row) && column >= Math.min(anchor.value.column, active.value.column) && column <= Math.max(anchor.value.column, active.value.column))
}
function text(point: Point) {
  const row = data.value[point.row], column = columns.value[point.column]
  if (!row || !column) return ''
  if (column.copyText) return column.copyText(row, point.row)
  // Read rendered text without invoking slots outside the render effect.
  const rendered = root.value?.querySelector<HTMLElement>(`[data-row-index="${point.row}"][data-column-index="${point.column}"] .virtual-cell-content`)
  if (rendered) return rendered.innerText.trim()
  const value = column.prop ? row[column.prop] : ''
  const formatted = column.formatter?.(row, scope(row, point.row, column).column, value, point.row)
  return typeof formatted === 'string' ? formatted : String(value ?? '')
}
function snapshot(): SelectedCell[] {
  if (!anchor.value || !active.value) return []
  const cells: SelectedCell[] = []
  for (let row = Math.min(anchor.value.row, active.value.row); row <= Math.max(anchor.value.row, active.value.row); row++) {
    for (let column = Math.min(anchor.value.column, active.value.column); column <= Math.max(anchor.value.column, active.value.column); column++) {
      if (eligible(column)) cells.push({ rowIndex: row, columnIndex: column, text: text({ row, column }) })
    }
  }
  return cells
}
function clear() { anchor.value = active.value = undefined; dragging = false; emit('cell-selection-change', []) }
function choose(point: Point, extend: boolean) {
  if (!extend || !anchor.value) anchor.value = point
  active.value = point; emit('cell-selection-change', snapshot())
}
function cellProps({ rowIndex, columnIndex }: { rowIndex: number; columnIndex: number }) {
  return {
    'data-row-index': rowIndex, 'data-column-index': columnIndex,
    'aria-selected': contains(rowIndex, columnIndex),
    class: { 'is-cell-selected': contains(rowIndex, columnIndex), 'is-cell-active': active.value?.row === rowIndex && active.value?.column === columnIndex },
    onMousedown(event: MouseEvent) {
      if (!props.cellSelection || props.loading || event.button !== 0 || !eligible(columnIndex) || (event.target instanceof Element && event.target.closest(interactive))) return
      event.preventDefault(); root.value?.focus({ preventScroll: true }); choose({ row: rowIndex, column: columnIndex }, event.shiftKey); dragging = true
    },
    onMouseover(event: MouseEvent) { if (dragging && event.buttons & 1 && eligible(columnIndex)) choose({ row: rowIndex, column: columnIndex }, true) },
    onClick(event: MouseEvent) { emit('row-click', data.value[rowIndex]!, scope(data.value[rowIndex]!, rowIndex, columns.value[columnIndex]!).column, event) },
  }
}
function keydown(event: KeyboardEvent) {
  if (!props.cellSelection || props.loading || !active.value || (event.target instanceof Element && event.target.closest(interactive))) return
  if (event.key === 'Escape') { clear(); event.preventDefault(); return }
  if (event.ctrlKey || event.metaKey || event.altKey) return
  const offset = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }[event.key]
  if (!offset) return
  event.preventDefault()
  let row = active.value.row + offset[0]!, column = active.value.column + offset[1]!
  while (row >= 0 && row < data.value.length && column >= 0 && column < columns.value.length) {
    if (eligible(column)) { choose({ row, column }, event.shiftKey); table.value?.scrollToRow(row); break }
    row += offset[0]!; column += offset[1]!
  }
}
function copy(event: ClipboardEvent) {
  if (!props.cellSelection || !active.value || (event.target instanceof Element && event.target.closest(interactive))) return
  const lines = new Map<number, string[]>()
  for (const cell of snapshot()) { const line = lines.get(cell.rowIndex) ?? []; line.push(cell.text.replace(/[\t\r\n]+/g, ' ')); lines.set(cell.rowIndex, line) }
  if (event.clipboardData) { event.clipboardData.setData('text/plain', [...lines.values()].map(line => line.join('\t')).join('\n')); event.preventDefault() }
}
function up() { dragging = false }
function outside(event: MouseEvent) { if (active.value && event.target instanceof Node && !root.value?.contains(event.target)) clear() }
onMounted(() => { document.addEventListener('mouseup', up); document.addEventListener('mousedown', outside); window.addEventListener('blur', up) })
onBeforeUnmount(() => { document.removeEventListener('mouseup', up); document.removeEventListener('mousedown', outside); window.removeEventListener('blur', up) })
watch([() => props.rows, () => props.rows.length, columns, () => props.cellSelection, () => props.loading], clear)
const virtualColumns = computed<Column[]>(() => columns.value.map((column, index) => ({
  key: column.key ?? column.prop ?? String(index), dataKey: column.prop,
  title: column.label, width: Number(column.width ?? column.minWidth ?? (column.type === 'selection' ? 48 : 160)),
  flexGrow: column.width ? 0 : 1, align: column.align as Column['align'],
  fixed: column.fixed === 'right' ? 'right' as Column['fixed'] : column.fixed ? true : undefined,
  class: column.className, sortable: !!column.sortable,
  headerCellRenderer: column.type === 'selection' ? () => {
    const available = props.rows.filter(selectable), count = available.filter(checked).length
    const availableKeys = new Set(available.map(key))
    return h(ElCheckbox, { modelValue: available.length > 0 && count === available.length, indeterminate: count > 0 && count < available.length, disabled: props.loading || !available.length, ariaLabel: '全选',
      'onUpdate:modelValue': value => emit('selection-change', value ? [...props.selectedRows.filter(row => !availableKeys.has(key(row))), ...available] : props.selectedRows.filter(row => !availableKeys.has(key(row)))) })
  } : ({ column: virtualColumn }) => {
    const header = props.cellSlots[`header-${column.key ?? column.prop}`] ?? column.slot?.header
    const id = columnKey(column)
    const canResize = props.columnSettings && id && id !== 'actions' && !column.settingsLocked && column.resizable !== false && (!column.type || column.type === 'default')
    return h('span', { class: 'virtual-column-heading' }, [
      header ? header({ column: scope({} as Row, 0, column).column, $index: index }) : column.label,
      canResize ? h(ColumnResizeHandle, { width: virtualColumn.width, minWidth: Math.max(64, Number(column.minWidth) || 64), label: column.label ?? id, onResize: value => emit('column-resize', id, value) }) : null,
    ])
  },
  cellRenderer: ({ rowData, rowIndex }) => column.type === 'selection' ? h(ElCheckbox, { modelValue: checked(rowData), disabled: props.loading || !selectable(rowData), ariaLabel: '选择行', 'onUpdate:modelValue': value => toggle(rowData, !!value) }) : h('span', { class: 'virtual-cell-content' }, [renderCell(rowData, rowIndex, column)]),
})))
function sortColumn({ key: columnKey, order }: { key: string | number | symbol; order: TableV2SortOrder }) {
  const index = virtualColumns.value.findIndex(column => column.key === columnKey), column = columns.value[index]
  if (!column) return
  sort.value = { key: String(columnKey), order }; clear()
  emit('sort-change', { column: scope({} as Row, 0, column).column, prop: column.prop ?? null, order: order === 'asc' ? 'ascending' : 'descending' })
}
defineExpose<TableHandle<Row>>({ clearCellSelection: clear, getSelectedCells: snapshot, clearSelection: () => emit('selection-change', []), getSelectionRows: () => props.selectedRows, toggleRowSelection: toggle, toggleRowExpansion: () => {}, clearSort: () => { sort.value = undefined; clear() } })
</script>

<template>
  <div ref="root" class="virtual-table" :style="{ height: `${height}px` }" :tabindex="cellSelection ? 0 : undefined" @keydown="keydown" @copy="copy">
    <ElAutoResizer><template #default="{ width, height: tableHeight }">
      <ElTableV2 ref="table" :width="width" :height="tableHeight" :columns="virtualColumns" :data="data" :row-key="options.rowKey as string" :row-height="options.size === 'small' ? 36 : options.size === 'large' ? 60 : 48" :header-height="48"
        :cell-props="cellProps" :sort-by="sortBy" @column-sort="sortColumn">
        <template v-if="$slots.empty" #empty><slot name="empty" /></template>
      </ElTableV2>
    </template></ElAutoResizer>
  </div>
</template>

<style scoped>
.virtual-table { min-width: 0; outline: none; }
.virtual-cell-content { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.virtual-table :deep(.el-table-v2__header-cell) { background: var(--el-fill-color-light); font-weight: 500; }
.virtual-table :deep(.el-table-v2__row-cell) { border-bottom: 1px solid var(--el-border-color-lighter); }
.virtual-table :deep(.is-cell-selected) { background: var(--el-color-primary-light-9); }
.virtual-table :deep(.is-cell-active) { box-shadow: inset 0 0 0 1.5px var(--el-color-primary); }
</style>
