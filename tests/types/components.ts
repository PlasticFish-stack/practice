import type { FormField } from '../../src/components/AppForm/types';
import type { ColumnOptions } from '../../src/components/AppTable/types';
interface Model {
  name: string;
  count: number;
  enabled: boolean;
  status: 'online' | 'offline';
}
const fields: FormField<Model>[] = [
  { prop: 'name', label: '名称', type: 'input' },
  { prop: 'count', label: '数量', type: 'number' },
  { prop: 'enabled', label: '启用', type: 'switch' },
  { prop: 'status', label: '状态', type: 'select', options: [{ label: '在线', value: 'online' }] },
];
// @ts-expect-error 字段名必须来自表单模型。
const invalidField: FormField<Model> = { prop: 'missing', label: '错误', type: 'input' };
// @ts-expect-error 数字字段不能配置为文本输入控件。
const invalidControl: FormField<Model> = { prop: 'count', label: '错误', type: 'input' };
const invalidOption: FormField<Model> = {
  prop: 'status',
  label: '错误',
  type: 'select',
  options: [
    {
      label: '错误',
      // @ts-expect-error 下拉选项必须属于字段值类型。
      value: 'unknown',
    },
  ],
};
// @ts-expect-error 列字段必须来自行模型。
const invalidColumn: ColumnOptions<Model> = { prop: 'missing' };
// @ts-expect-error 继承的原生属性仍应保留具体类型。
const invalidWidth: ColumnOptions<Model> = { prop: 'name', width: true };
// @ts-expect-error 字符串日期必须指定 valueFormat，避免写入 Date 对象。
const invalidDate: FormField<Model> = { prop: 'name', label: '日期', type: 'date' };
const columns: ColumnOptions<Model>[] = [
  { prop: 'name' },
  { key: 'actions', label: '操作' },
  { type: 'selection' },
];
void [
  fields,
  invalidField,
  invalidControl,
  invalidOption,
  invalidColumn,
  invalidWidth,
  invalidDate,
  columns,
];
