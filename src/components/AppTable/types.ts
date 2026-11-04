import type { ElInput, ElInputNumber, ElSwitch, ElTable, ElTableColumn, TableColumnCtx } from 'element-plus'
import type { VNode, VNodeChild } from 'vue'

export type TableRow = object
export type CellScope<Row extends object> = { row: Row; column: TableColumnCtx<Row>; $index: number }
export type ColumnSlots<Row extends object> = {
  default?: (scope: CellScope<Row>) => VNodeChild
  header?: (scope: { column: TableColumnCtx<Row>; $index: number }) => VNodeChild
  'filter-icon'?: (scope: { filterOpened: boolean }) => VNodeChild
  /** 兼容旧配置；新代码使用原生插槽名 filter-icon。 */
  filterIcon?: (scope: { filterOpened: boolean }) => VNodeChild
}
export type ColumnEdit<Row extends object> =
  | { type: 'string'; onEdit: (row: Row, value: string) => void; editProps?: Partial<InstanceType<typeof ElInput>['$props']> }
  | { type: 'number'; onEdit: (row: Row, value: number | undefined) => void; editProps?: Partial<InstanceType<typeof ElInputNumber>['$props']> }
  | { type: 'boolean'; onEdit: (row: Row, value: boolean | number | string) => void; editProps?: Partial<InstanceType<typeof ElSwitch>['$props']> }

// 去除 Vue SFC 的任意属性后备签名，保留原生属性及其行类型。
type NativeProps<Props> = { [Key in keyof Props as string extends Key ? never : number extends Key ? never : Key]: Props[Key] }
type NativeColumn<Row extends object> = Omit<NativeProps<Parameters<typeof ElTableColumn<Row>>[0]>, 'prop' | 'formatter' | 'type' | 'children'>
export type ColumnOptions<Row extends object> = NativeColumn<Row> & {
  key?: string
  prop?: keyof Row & string
  type?: 'default' | 'selection' | 'index' | 'expand'
  /** 兼容旧配置；新代码建议 type: 'expand'。 */
  expand?: boolean
  hidden?: boolean
  /** 保留该列的位置、可见性和宽度，不允许用户修改。 */
  settingsLocked?: boolean
  /** 禁止该列参与单元格区域选择，例如操作列。 */
  cellSelectable?: boolean
  /** 自定义组件或未渲染虚拟单元格的复制文本。 */
  copyText?: (row: Row, rowIndex: number) => string
  children?: readonly ColumnOptions<Row>[]
  formatter?: (row: Row, column: TableColumnCtx<Row>, value: unknown, index: number) => string | VNode
  render?: (scope: CellScope<Row>) => VNodeChild
  slot?: ColumnSlots<Row>
  edit?: ColumnEdit<Row>
}
export type TableOptions<Row extends object = TableRow> = Omit<NativeProps<Parameters<typeof ElTable<Row>>[0]>, 'data'>
export type SortChange<Row extends object> = { column: TableColumnCtx<Row>; prop: string | null; order: 'ascending' | 'descending' | null }
export type TablePagination = { page: number; pageSize: number; total: number }
export type SelectedCell = { rowIndex: number; columnIndex: number; text: string }
export interface TableHandle<Row extends object> {
  clearCellSelection: () => void
  getSelectedCells: () => SelectedCell[]
  clearSelection: () => void
  getSelectionRows: () => Row[]
  toggleRowSelection: (row: Row, selected?: boolean) => void
  toggleRowExpansion: (row: Row, expanded?: boolean) => void
  clearSort: () => void
}
export type TableCellSlots<Row extends object> = {
  [name: `cell-${string}`]: ((scope: CellScope<Row>) => VNodeChild) | undefined
} & {
  [name: `header-${string}`]: ((scope: { column: TableColumnCtx<Row>; $index: number }) => VNodeChild) | undefined
}
export type TableSlots<Row extends object> = TableCellSlots<Row> & {
  toolbar?: (scope: { selection: Row[] }) => VNodeChild
  empty?: () => VNodeChild
  append?: () => VNodeChild
}
