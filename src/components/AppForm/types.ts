import type { FormItemRule, FormProps, InputProps, InputNumberProps, SelectProps, SwitchProps, DatePickerProps } from 'element-plus'
import type { VNodeChild } from 'vue'

type Primitive = string | number | boolean
type InputOptions = Partial<Omit<InputProps, 'modelValue' | 'disabled' | 'type'>> & { type?: 'text' | 'password' | 'email' | 'tel' | 'url' }
type DateOptions = Partial<Omit<DatePickerProps, 'modelValue' | 'disabled' | 'type' | 'valueFormat'>>
export type SelectOption<Value = Primitive> = { label: string; value: Value; disabled?: boolean }
type Common<Model, Key extends keyof Model & string> = {
  prop: Key
  label: string
  span?: number
  visible?: boolean | ((model: Readonly<Model>) => boolean)
  disabled?: boolean | ((model: Readonly<Model>) => boolean)
  rules?: FormItemRule[]
  hint?: string
}
type Control<Value> =
  | { type: 'slot' }
  | (NonNullable<Value> extends string ? { type: 'input' | 'textarea'; props?: InputOptions & { rows?: number } } : never)
  | (NonNullable<Value> extends number ? { type: 'number'; props?: Partial<Omit<InputNumberProps, 'modelValue' | 'disabled'>> } : never)
  | (NonNullable<Value> extends boolean ? { type: 'switch'; props?: Partial<Omit<SwitchProps, 'modelValue' | 'disabled' | 'activeValue' | 'inactiveValue'>> } : never)
  | (NonNullable<Value> extends Primitive ? { type: 'select'; options: readonly SelectOption<NonNullable<Value>>[]; props?: Partial<Omit<SelectProps, 'modelValue' | 'disabled' | 'multiple'>> } : never)
  | (NonNullable<Value> extends string ? { type: 'date'; props: DateOptions & { valueFormat: string } } : never)
  | (NonNullable<Value> extends Date ? { type: 'date'; props?: DateOptions } : never)

export type FormField<Model extends object> = {
  [Key in keyof Model & string]: Common<Model, Key> & Control<Model[Key]>
}[keyof Model & string]
export type FormOptions = Partial<Omit<FormProps, 'model' | 'rules' | 'disabled'>>
export interface FormHandle<Model extends object> {
  validate: () => Promise<boolean>
  submit: () => Promise<boolean>
  reset: (values?: Model) => void
  clearValidate: () => void
}
export type FieldSlot<Model extends object> = {
  model: Model
  field: FormField<Model>
  value: Model[keyof Model]
  update: (value: unknown) => void
  disabled: boolean
}
export type FormSlots<Model extends object> = {
  [name: `field-${string}`]: (scope: FieldSlot<Model>) => VNodeChild
} & {
  actions?: (scope: { submit: () => Promise<boolean>; reset: () => void; disabled: boolean }) => VNodeChild
}
