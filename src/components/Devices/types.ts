import type { ElInput, ElInputNumber, ElSwitch, ElTable, ElTableColumn, TableColumnCtx } from "element-plus"
import type { VNode, VNodeArrayChildren } from "vue"

export type TableRow = Record<PropertyKey, any>

type SlotReturn = string | number | boolean | VNode | VNodeArrayChildren | (() => any)

export type ColumnOptions<Row extends TableRow> = Omit<Parameters<typeof ElTableColumn>[0], 'prop' | 'formatter'> &
{
    key?: string
    // label?: string
    // width?: number
    formatter?: (row: Row, column: TableColumnCtx<Row>, cellValue: any, index: number) => VNode | string;
    search?: boolean
} & ColumnBinding<Row>

type ColumnSlots<Row extends TableRow> = {
    default?: (scope: { row: Row, column: TableColumnCtx<Row>, $index: number }) => SlotReturn;
    header?: (scope: { column: TableColumnCtx<Row>, $index: number }) => SlotReturn;
    filterIcon?: (scope: { filterOpened: boolean }) => SlotReturn;
    expand?: (scope: { expanded: boolean, expandable: boolean }) => SlotReturn;
}

type ColumnBinding<Row extends TableRow> = | {
    prop?: never
    expand?: true
    edit?: never
    slot: Omit<ColumnSlots<Row>, 'default'> & {
        default: (scope: { row: Row, column: TableColumnCtx<Row>, $index: number }) => SlotReturn;
    }
} | ({
    prop: keyof Row & string
    expand?: false
    slot?: Omit<ColumnSlots<Row>, 'expand'>
    edit?: ColumnEdit<Row>
})

type ColumnEdit<Row extends TableRow> = |
{
    type: 'string'
    onEdit: (row: Row, value: string) => void
    editProps?: InstanceType<typeof ElInput>['$props']
} | {
    type: 'number'
    onEdit: (row: Row, value: number | undefined) => void
    editProps?: InstanceType<typeof ElInputNumber>['$props']
} | {
    type: 'boolean'
    onEdit: (row: Row, value: boolean | number | string) => void
    editProps?: InstanceType<typeof ElSwitch>['$props']
}

export type TableOptions = Omit<Parameters<typeof ElTable>[0], 'data'>