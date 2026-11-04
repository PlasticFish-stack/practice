<script setup lang="ts" generic="Row extends object">
import { h } from 'vue'
import { ElInput, ElInputNumber, ElSwitch, ElTableColumn } from 'element-plus'
import 'element-plus/es/components/input/style/css'
import 'element-plus/es/components/input-number/style/css'
import 'element-plus/es/components/switch/style/css'
import type { VNodeChild } from 'vue'
import type { CellScope, ColumnOptions, TableCellSlots } from './types'
import ColumnResizeHandle from './ColumnResizeHandle.vue'
import DragHandleIcon from './DragHandleIcon.vue'

const props = defineProps<{ column: ColumnOptions<Row>; cellSlots: TableCellSlots<Row>; resizeColumn?: (id: string, width: number) => void; rowDrag?: { disabled: boolean; target: Row | null; start: (event: DragEvent, row: Row) => void; over: (event: DragEvent, row: Row) => void; drop: (event: DragEvent, row: Row) => void; end: () => void } }>()

function visible(column: ColumnOptions<Row>): boolean {
  return !column.hidden && (!column.children?.length || column.children.some(visible))
}
function renderColumn(column: ColumnOptions<Row>): VNodeChild {
  if (!visible(column)) return null
  const { children, hidden: _hidden, settingsLocked, cellSelectable, copyText: _copyText, slot, render, edit, expand, key, ...bindings } = column
  const identity = key ?? column.prop
  const header = props.cellSlots[`header-${identity}`] ?? slot?.header
  const groupBindings: Record<string, unknown> = { ...bindings, key }
  if (children?.length) return h(ElTableColumn, groupBindings, {
    ...(header ? { header } : {}), default: () => children.map(renderColumn),
  })
  const cell = props.cellSlots[`cell-${identity}`] ?? render ?? slot?.default
  const nativeType = expand ? 'expand' : column.type
  const filterIcon = slot?.['filter-icon'] ?? slot?.filterIcon
  const slots: ColumnOptions<Row>['slot'] = { ...slot, ...(header ? { header } : {}), ...(filterIcon ? { 'filter-icon': filterIcon } : {}) }
  if (props.resizeColumn && identity) slots.header = scope => h('span', { class: 'app-column-heading' }, [
    header ? header(scope) : column.label,
    h(ColumnResizeHandle, { width: scope.column.realWidth || Number.parseFloat(String(column.width ?? column.minWidth)) || 160, minWidth: Math.max(64, Number.parseFloat(String(column.minWidth)) || 64), label: column.label ?? identity, onResize: value => props.resizeColumn?.(identity, value) }),
  ])
  // 选择与序号列保留 Element Plus 的原生单元格。
  if (nativeType !== 'selection' && nativeType !== 'index') {
    if (cell) slots.default = cell
    else if (edit && column.prop) slots.default = (scope: CellScope<Row>) => {
      const value = scope.row[column.prop!]
      if (edit.type === 'string') return h(ElInput, { ariaLabel: column.label, ...edit.editProps, modelValue: typeof value === 'string' ? value : '',
        'onUpdate:modelValue': (next: string) => edit.onEdit(scope.row, next) })
      if (edit.type === 'number') return h(ElInputNumber, { ariaLabel: column.label, ...edit.editProps, modelValue: typeof value === 'number' ? value : undefined,
        'onUpdate:modelValue': (next: number | undefined) => edit.onEdit(scope.row, next) })
      return h(ElSwitch, { ariaLabel: column.label, ...edit.editProps, modelValue: value as boolean,
        'onUpdate:modelValue': (next: boolean | string | number) => edit.onEdit(scope.row, next) })
    }
  }
  if (props.rowDrag && nativeType !== 'selection' && nativeType !== 'index' && nativeType !== 'expand') {
    const content = slots.default
    slots.default = (scope: CellScope<Row>) => h('span', {
      class: ['row-drop-zone', { 'is-drop-target': props.rowDrag?.target === scope.row }],
      onDragover: (event: DragEvent) => props.rowDrag?.over(event, scope.row),
      onDrop: (event: DragEvent) => props.rowDrag?.drop(event, scope.row),
    }, [
      h('button', { type: 'button', class: 'row-drag-handle', draggable: !props.rowDrag?.disabled, disabled: props.rowDrag?.disabled,
        'aria-label': '拖拽调整同级顺序', title: '拖拽调整同级顺序',
        onDragstart: (event: DragEvent) => props.rowDrag?.start(event, scope.row), onDragend: () => props.rowDrag?.end(),
        onClick: (event: MouseEvent) => event.stopPropagation(),
      }, [h(DragHandleIcon)]),
      content ? content(scope) : column.formatter ? column.formatter(scope.row, scope.column, scope.row[column.prop!], scope.$index) : String(scope.row[column.prop!] ?? ''),
    ])
  }
  const nativeBindings: Record<string, unknown> = {
    ...bindings, key, type: nativeType, columnKey: bindings.columnKey ?? identity,
    resizable: settingsLocked || identity === 'actions' || identity === 'tree-toggle' || (!!nativeType && nativeType !== 'default') ? false : bindings.resizable,
    className: [bindings.className, cellSelectable === false || ['selection', 'index', 'expand'].includes(nativeType ?? '') ? 'app-cell-unselectable' : ''].filter(Boolean).join(' '),
  }
  return h(ElTableColumn, nativeBindings, slots)
}
// 函数组件身份稳定，值变化不会导致输入框重新挂载、丢失焦点。
const ColumnRenderer = () => renderColumn(props.column)
</script>

<template><ColumnRenderer /></template>
