# 表单与表格

公共组件继续使用 Element Plus，字段配置负责重复结构，复杂内容用 Vue 插槽。请求、权限、服务端字段转换和业务校验留在页面；组件不会自行请求接口或修改表格行。

## AppForm

```vue
<script setup lang="ts">
import { ref } from 'vue'
import AppForm from '@/components/AppForm/AppForm.vue'
import type { FormField } from '@/components/AppForm/types'

type Model = { name: string; brightness: number; enabled: boolean }
const defaults = (): Model => ({ name: '', brightness: 0, enabled: false })
const form = ref(defaults())
const fields: FormField<Model>[] = [
  { prop: 'name', label: '名称', type: 'input', rules: [
    { required: true, whitespace: true, message: '请输入名称', trigger: 'blur' },
  ] },
  { prop: 'brightness', label: '亮度', type: 'number', props: { min: 0, max: 100 } },
  { prop: 'enabled', label: '启用', type: 'switch' },
]
function save(values: Model) { console.log(values) }
</script>

<template>
  <AppForm v-model="form" :fields="fields" :defaults="defaults" :columns="2" @submit="save" />
</template>
```

字段名取自模型，数字、开关、下拉选项也有类型约束。支持 `input`、`textarea`、`number`、`switch`、`select`、`date` 和 `slot`。`props` 转交对应的 Element Plus 控件；日期控件按需加载。

- `span`：占用网格列数；窄屏自动单列。搜索栏可设置 `inline`。
- `visible`、`disabled`：布尔值或接收当前模型的函数。隐藏字段保留值，不参与已挂载表单项的校验；提交前由业务决定是否删除这些字段。
- `rules`：字段级 Element Plus 校验；表单级规则可通过组件的 `rules` 传入。
- `options`：原生 `ElForm` 参数，例如 `labelPosition`、`labelWidth`、`validateOnRuleChange`。
- `loading`：提交请求期间禁用表单、显示提交按钮忙碌状态。校验期间也会锁定输入，防止重复提交。
- `showActions`、`showReset`、`submitText`、`resetText`：操作栏配置。

`@submit` 只在校验通过后触发；业务保存函数仍需自行设置 `loading` 和处理错误。可清空的数字字段应允许 `undefined`，例如 `brightness: number | undefined`，再使用必填规则阻止空值提交。字符串日期必须配置 `props: { valueFormat: 'YYYY-MM-DD' }`；使用 `Date` 模型时不配置 `valueFormat`。

重置优先使用 `defaults()` 的最新值，否则恢复组件首次挂载时的值，并清除校验提示。表单模型应为可通过 `structuredClone` 复制的普通数据。编辑弹窗切换记录时，由父组件写入新模型，并清除校验或重新挂载表单。

自定义字段使用 `field-字段名` 插槽，配置中写 `type: 'slot'`。使用传入的 `update` 更新字段，使用 `disabled` 控制自定义控件：

```vue
<template #field-name="{ model, update, disabled }">
  <el-input :model-value="model.name" :disabled="disabled" @update:model-value="update" />
</template>
```

`actions` 插槽提供 `submit`、`reset`、`disabled`。自定义提交按钮使用 `native-type="submit"`，或调用 `submit()`；两种方式都经过校验。组件 ref 暴露 `validate()`、`submit()`、`reset(values?)`、`clearValidate()`，对应类型为 `FormHandle<Model>`。

实际用法见 `views/devices/components/DeviceSearch.vue`、`DeviceEditDialog.vue` 与 `views/account/components/ProfileEditor.vue`。

## AppTable

```vue
<script setup lang="ts">
import AppTable from '@/components/AppTable/AppTable.vue'
import type { ColumnOptions } from '@/components/AppTable/types'

type Row = { id: number; name: string; status: string }
const rows: Row[] = [{ id: 1, name: '设备 A', status: 'online' }]
const columns: ColumnOptions<Row>[] = [
  { type: 'selection', width: 48 },
  { prop: 'name', label: '名称', minWidth: 160, showOverflowTooltip: true },
  { prop: 'status', label: '状态', width: 100 },
  { key: 'actions', label: '操作', width: 100, fixed: 'right' },
]
function edit(row: Row) { console.log(row) }
</script>

<template>
  <AppTable :rows="rows" :column-options="columns" :table-options="{ rowKey: 'id' }" title="设备列表">
    <template #cell-status="{ row }"><el-tag>{{ row.status }}</el-tag></template>
    <template #cell-actions="{ row }"><el-button link @click="edit(row)">编辑</el-button></template>
  </AppTable>
</template>
```

- `columnOptions` 支持原生 `width`、`minWidth`、`fixed`、`align`、`sortable`、`formatter`、`filters` 等参数，运行时会转交 `ElTableColumn`。
- 分组表头使用 `children`，动态显示使用 `hidden`。没有数据字段的操作列使用唯一 `key`；动态调整列顺序时也建议为每列设置稳定的 `key`。
- 选择、序号、展开列使用 `type: 'selection' | 'index' | 'expand'`。展开内容同样通过 `cell-key` 插槽提供。
- 单元格渲染顺序：模板 `cell-key` 插槽 → `render` → 配置 `slot.default` → 旧版 `edit` → 原生默认内容或 `formatter`。`key` 未配置时使用 `prop`。选择和序号列保留原生渲染。
- 表头使用 `header-key` 插槽或配置 `slot.header`。原生表格的其他参数、事件可通过 `tableOptions` 或组件属性传递。
- 旧版 `edit: { type, onEdit, editProps }` 继续可用。`onEdit` 由调用方决定更新本地行还是保存服务端；组件不会替调用方修改原数据，数值 `0` 和布尔值 `false` 不会被当作空值。

`sortable: true` 只排序当前加载的行；服务端排序使用 `sortable: 'custom'`，监听 `@sort-change` 后重新请求接口。通用表格不知道服务端的排序协议。

工具栏使用 `toolbar` 插槽，提供当前 `selection`；`empty`、`append` 插槽转交原生表格。常用事件有 `selection-change`、`sort-change`、`row-click`。组件 ref 暴露 `clearSelection()`、`getSelectionRows()`、`toggleRowSelection(row, selected?)`、`clearSort()`，类型为 `TableHandle<Row>`。

### 分页

```vue
<AppTable
  :rows="rows"
  :column-options="columns"
  :loading="loading"
  :pagination="{ page, pageSize, total }"
  @page-change="load"
/>
```

`page-change` 参数为 `{ page, pageSize }`。修改每页条数时回到第一页；父组件写回服务器分页数据不会重复发出查询。窄屏自动使用紧凑分页，保留翻页和页码。独立的 `AppPagination` 也可继续使用。

页面负责在请求成功后更新行、总数和分页，并保留筛选条件；并发取消和错误提示仍由页面管理。实际示例见 `views/devices/DeviceList.vue`。

## 验证

`pnpm build` 包括字段配置和组件插槽的 TypeScript 检查。`tests/types/components.ts` 检查无效字段、控件类型、下拉选项和字符串日期配置能否被类型系统拒绝。

`pnpm test:e2e` 包含表单校验、连续输入焦点、日期、条件字段、重置、数字零值、表格原生属性、分组表头、选择、排序、展开、动态列，以及真实设备搜索、分页和保存流程。
