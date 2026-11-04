<script setup lang="ts" generic="Row extends object">
import { h } from 'vue'
import { ElInput, ElInputNumber, ElSwitch, ElTableColumn } from 'element-plus'
import 'element-plus/es/components/input/style/css'
import 'element-plus/es/components/input-number/style/css'
import 'element-plus/es/components/switch/style/css'
import type { VNodeChild } from 'vue'
import type { CellScope, ColumnOptions, TableCellSlots } from './types'

const props = defineProps<{ column: ColumnOptions<Row>; cellSlots: TableCellSlots<Row> }>()

function visible(column: ColumnOptions<Row>): boolean {
  return !column.hidden && (!column.children?.length || column.children.some(visible))
}
function renderColumn(column: ColumnOptions<Row>): VNodeChild {
  if (!visible(column)) return null
  const { children, hidden: _hidden, slot, render, edit, expand, key, ...bindings } = column
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
  const nativeBindings: Record<string, unknown> = { ...bindings, key, type: nativeType }
  return h(ElTableColumn, nativeBindings, slots)
}
// 函数组件身份稳定，值变化不会导致输入框重新挂载、丢失焦点。
const ColumnRenderer = () => renderColumn(props.column)
</script>

<template><ColumnRenderer /></template>
