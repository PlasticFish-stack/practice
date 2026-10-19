<script setup lang="ts" generic="T extends TableRow">
import { h, type VNode, } from 'vue';
import ElInput from 'element-plus/es/components/input/index';
import ElInputNumber from 'element-plus/es/components/input-number/index';
import ElSwitch from 'element-plus/es/components/switch/index';
import { ElTableColumn } from 'element-plus/es/components/table/index';
import type { ColumnOptions, TableOptions, TableRow } from './types';


type ColumnItem = {
    context: ColumnOptions<T>,
    component: () => VNode
}

const props = defineProps<{
    devices: T[]
    loading: boolean
    columnOptions: ColumnOptions<T>[]
    tableOptions?: TableOptions
}>()

function createEditSlot(option: ColumnOptions<T>): ColumnOptions<T> {
    if (!option.edit) return option
    const field = option.prop
    const edit = option.edit
    const slot = option.slot ?? {}
    if (edit.type === 'string') {
        const onEdit = edit.onEdit
        slot['default'] = ({ row }) => h(ElInput, {
            modelValue: row[field],
            'onUpdate:modelValue': (value: string) => {
                onEdit(row, value)
            },
            ...edit.editProps
        })
    }
    if (edit.type === 'number') {
        const onEdit = edit.onEdit
        slot['default'] = ({ row }) => h(ElInputNumber, {
            modelValue: row[field],
            'onUpdate:modelValue': (value: number | undefined) => {
                onEdit(row, value)
            },
            ...edit.editProps
        })
    }
    if (edit.type === 'boolean') {
        const onEdit = edit.onEdit
        slot['default'] = ({ row }) => h(ElSwitch, {
            modelValue: row[field],
            'onUpdate:modelValue': (value: boolean | number | string) => {
                onEdit(row, value)
            },
            ...edit.editProps
        })
    }
    option.slot = slot
    return option
}

const columnComponent: ColumnItem[] = props.columnOptions.map((option) => {
    const field = option.prop
    const prop: Record<string, unknown> = {
        prop: field,
        formatter: option.formatter,
    }
    if (option.expand) {
        prop['type'] = 'expand'
    }
    if (option.edit && field !== undefined) {
        option = createEditSlot(option)
    }
    return {
        context: option,
        component: () => h(
            ElTableColumn,
            prop,
            option.slot
        )
    }
})

</script>

<template>
    <el-table v-bind="{ ...tableOptions }" v-loading="loading" :data="devices">
        <template v-for="(column, idx) in columnComponent" :key="column.context.key ?? column.context.prop ?? idx">
            <component :is="column.component" />
        </template>
    </el-table>

</template>

<style scoped lang="scss"></style>
