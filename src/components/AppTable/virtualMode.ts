import type { ColumnOptions, TableOptions } from './types'

/** Return a reason instead of silently dropping a Table V1 feature. */
export function virtualFallback<Row extends object>(columns: readonly ColumnOptions<Row>[], options: TableOptions<Row>, rowDraggable: boolean, hasAppend: boolean, hasAttrs: boolean): string | undefined {
  if (rowDraggable) return 'row-drag'
  if (hasAppend) return 'append-slot'
  if (hasAttrs) return 'native-attributes'
  const supportedOptions = new Set(['rowKey', 'height', 'maxHeight', 'size'])
  if (Object.entries(options).some(([key, value]) => value !== undefined && !supportedOptions.has(key))) return 'table-options'
  const supportedColumns = new Set(['key', 'prop', 'type', 'hidden', 'settingsLocked', 'resizable', 'cellSelectable', 'copyText', 'label', 'width', 'minWidth', 'fixed', 'align', 'className', 'formatter', 'render', 'slot', 'sortable', 'index', 'selectable', 'reserveSelection'])
  for (const column of columns) {
    if (column.hidden) continue
    if (column.children?.length) return 'grouped-columns'
    if (column.type === 'expand' || column.expand) return 'expanded-content'
    if ([column.width, column.minWidth].some(value => value !== undefined && (!Number.isFinite(Number(value)) || Number(value) <= 0))) return 'column-width'
    if (column.sortable && !(column.key ?? column.prop)) return 'column-key'
    if (Object.entries(column).some(([key, value]) => value !== undefined && !supportedColumns.has(key))) return 'column-options'
    if (column.slot && Object.keys(column.slot).some(key => !['default', 'header'].includes(key))) return 'column-slots'
  }
}
