# 表单与表格

SSH 风格的终端组件与 WebSocket 网关接口见 [terminal.md](./terminal.md)。

图表基础组件、主题和更新约定见 [charts.md](./charts.md)。

公共组件继续使用 Element Plus，字段配置负责重复结构，复杂内容用 Vue 插槽。请求、权限、服务端字段转换和业务校验留在页面；组件不会自行请求接口或修改表格行。

## AppForm

```vue
<script setup lang="ts">
import { ref } from 'vue';
import AppForm from '@/components/AppForm/AppForm.vue';
import type { FormField } from '@/components/AppForm/types';

type Model = { name: string; brightness: number; enabled: boolean };
const defaults = (): Model => ({ name: '', brightness: 0, enabled: false });
const form = ref(defaults());
const fields: FormField<Model>[] = [
  {
    prop: 'name',
    label: '名称',
    type: 'input',
    rules: [{ required: true, whitespace: true, message: '请输入名称', trigger: 'blur' }],
  },
  { prop: 'brightness', label: '亮度', type: 'number', props: { min: 0, max: 100 } },
  { prop: 'enabled', label: '启用', type: 'switch' },
];
function save(values: Model) {
  console.log(values);
}
</script>

<template>
  <AppForm
    v-model="form"
    :fields="fields"
    :defaults="defaults"
    :columns="2"
    @submit="save"
  />
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
  <el-input
    :model-value="model.name"
    :disabled="disabled"
    @update:model-value="update"
  />
</template>
```

`actions` 插槽提供 `submit`、`reset`、`disabled`。自定义提交按钮使用 `native-type="submit"`，或调用 `submit()`；两种方式都经过校验。组件 ref 暴露 `validate()`、`submit()`、`reset(values?)`、`clearValidate()`，对应类型为 `FormHandle<Model>`。

实际用法见 `views/devices/components/DeviceSearch.vue`、`DeviceEditDialog.vue` 与 `views/account/components/ProfileEditor.vue`。

## AppTable

```vue
<script setup lang="ts">
import AppTable from '@/components/AppTable/AppTable.vue';
import type { ColumnOptions } from '@/components/AppTable/types';

type Row = { id: number; name: string; status: string };
const rows: Row[] = [{ id: 1, name: '设备 A', status: 'online' }];
const columns: ColumnOptions<Row>[] = [
  { type: 'selection', width: 48 },
  { prop: 'name', label: '名称', minWidth: 160, showOverflowTooltip: true },
  { prop: 'status', label: '状态', width: 100 },
  { key: 'actions', label: '操作', width: 100, fixed: 'right' },
];
function edit(row: Row) {
  console.log(row);
}
</script>

<template>
  <AppTable
    :rows="rows"
    :column-options="columns"
    :table-options="{ rowKey: 'id' }"
    title="设备列表"
  >
    <template #cell-status="{ row }">
      <el-tag>{{ row.status }}</el-tag>
    </template>
    <template #cell-actions="{ row }">
      <el-button
        link
        @click="edit(row)"
      >
        编辑
      </el-button>
    </template>
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

### 单元格区域选择

参考 [Surely Vue 的 rangeSelection API](https://github.com/surely-vue/surely-table/blob/main/src/doc/api.zh-CN.md)，AppTable 默认支持一个矩形选区：

- 单击数据格显示蓝色边框；鼠标拖动或 Shift + 单击扩展选区。
- 方向键移动，Shift + 方向键扩展，Esc 清空；点击表格外也会清空。
- Ctrl/Cmd + C 复制选区的显示文本，以制表符分列、换行分行，可粘贴到 Excel。
- 行勾选、编辑控件、链接、折叠和拖拽手柄独立操作。选择、序号、展开列不参与选区；操作列可配置 `cellSelectable: false`。
- `:cell-selection="false"` 关闭，恢复原生文本划词选择。
- `@cell-selection-change` 返回 `SelectedCell[]`，包含当前可见行的零基 `rowIndex`、全部叶子列的零基 `columnIndex` 和显示 `text`。这些索引不是业务主键。
- ref 提供 `getSelectedCells()` 和 `clearCellSelection()`。数据集、列配置、排序、展开或加载状态变化会清空选区，避免选中旧位置。

当前支持单个矩形范围，不包含多段不连续选区；合并单元格不参与选择。

### 行拖动排序

`rowDraggable` 开启行排序，`dragColumn` 指定手柄列（默认首个普通数据列）。拖动从手柄开始，整行的数据格、空白和固定操作列都接收落点；拖动期间行内控件不参与鼠标命中，结束后恢复交互。

`canDrop(source, target)` 限制可放置的行，例如只允许同级菜单。有效放置触发 `row-reorder`，由页面负责保存；拖回自身、无效落点和按 Escape 取消不会触发保存。加载、数据替换或页面停用时清理拖动状态。

### 列设置

AppTable 默认在工具栏提供“列设置”：显示/隐藏数据列、拖动排序（也可用上移/下移按钮）、输入列宽、恢复默认。数据列表头右边缘支持拖动调整宽度；虚拟表格使用相同交互，手柄还支持左右方向键每次调整 10px。

```vue
<AppTable table-key="devices.list" :rows="rows" :column-options="columns" />
```

- `tableKey` 是稳定的表格标识，配置保存到当前浏览器 localStorage，各表互不影响。没有配置时，仅在当前组件实例内记忆；如需按账户隔离，可传入包含用户 ID 的 key。
- `:column-settings="false"` 关闭面板和自定义列配置。
- 每个数据列使用稳定且唯一的 `key` 或 `prop`。业务侧 `hidden: true` 的列不出现在面板中；权限变化后，历史设置不能将这些列重新显示。
- 选择、序号、折叠、操作列、未命名列和分组表头保留原有位置。分组表头目前不提供组内自定义。其他列按左固定、普通、右固定区域分别排序，不跨区域移动。
- `settingsLocked: true` 保留指定列的位置、可见性与宽度；`resizable: false` 仅禁止调整列宽。至少保留一列数据，不能全部隐藏。
- 配置只保存列标识、顺序、可见性与宽度，不保存行数据。损坏的本地配置自动回到默认；宽度受列的 `minWidth` 和合理范围约束。
- 状态由 `useTableColumns` 管理，面板由 `TableColumnSettings` 渲染，表头的指针捕获由 `ColumnResizeHandle` 管理。AppTable 只负责把结果交给普通/虚拟渲染器。

### 自动虚拟化

AppTable 的 `virtual` 默认是 `'auto'`：**没有配置分页且 `rows.length >= 500`** 时，兼容的平铺表格切换到 Element Plus Table V2。500 是可调策略，不是性能保证。

```vue
<AppTable
  :rows="rows"
  :column-options="columns"
  :table-options="{ rowKey: 'id' }"
  virtual="auto"
  :virtual-threshold="500"
  :virtual-height="480"
/>
```

- `:virtual="false"` 始终使用普通表格；`:virtual="true"` 忽略行数和分页条件，但仍执行兼容性检查。
- 虚拟模式需要唯一且非空的字符串/数字主键，`tableOptions.rowKey` 使用字段名。
- 默认固定行高 48px（small 36px、large 60px）；视口高度优先使用数字 `tableOptions.height` / `maxHeight`，否则使用 `virtualHeight`，默认 480px。
- 已适配平铺数据、固定列、选择/序号列、单列排序、自定义表头/单元格插槽、formatter、单元格矩形选区和复制。虚拟选区按数据索引记录，滚动回收节点不会改变选区。
- 树形数据、行拖拽、展开内容、分组表头、合并格、筛选、编辑、append 插槽及其他尚未适配的原生属性/事件自动保留普通表格。不会为了虚拟化丢弃这些功能。
- `@render-mode-change` 返回 `{ mode: 'standard' | 'virtual', reason?: string }`，可用于调试回退原因。根节点 `data-render-mode` 标记实际模式。
- 模式切换时保留已勾选行，清空单元格选区；排序状态不跨模式保留。刷新虚拟表格数据时按主键更新已勾选的行对象，默认移除已删除的行；`reserveSelection: true` 则保留不在当前数据集中的勾选记录。
- 自定义单元格建议配置 `copyText: (row, rowIndex) => string`，保证滚动到屏幕外之后仍能正确复制。未配置时，优先读取已挂载格子的显示文本；未挂载格子使用字符串 formatter 或原始字段值，不会在渲染流程外调用插槽。

### 分页用法

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
