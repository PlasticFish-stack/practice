<script setup lang="ts" generic="Model extends object">
import { computed, defineAsyncComponent, h, nextTick, shallowRef, toRaw, useTemplateRef } from 'vue'
import type { FormInstance, FormRules } from 'element-plus'
import { ElInput, ElInputNumber, ElSelect, ElOption, ElSwitch } from 'element-plus'
import 'element-plus/es/components/input/style/css'
import 'element-plus/es/components/input-number/style/css'
import 'element-plus/es/components/select/style/css'
import 'element-plus/es/components/switch/style/css'
import type { FormField, FormHandle, FormOptions, FormSlots } from './types'

defineOptions({ inheritAttrs: false })
const model = defineModel<Model>({ required: true })
const props = withDefaults(defineProps<{
  fields: readonly FormField<Model>[]
  rules?: FormRules<Model>
  defaults?: () => Model
  options?: FormOptions
  columns?: number
  inline?: boolean
  disabled?: boolean
  loading?: boolean
  submitText?: string
  resetText?: string
  showActions?: boolean
  showReset?: boolean
}>(), { columns: 1, inline: false, disabled: false, loading: false, submitText: '提交', resetText: '重置', showActions: true, showReset: true })
defineSlots<FormSlots<Model>>()
const emit = defineEmits<{ submit: [model: Model]; reset: [model: Model] }>()
const form = useTemplateRef<FormInstance>('form')
const DateControl = defineAsyncComponent(() => import('./DateControl'))
const baseline = structuredClone(toRaw(model.value))
const validating = shallowRef(false)
const locked = computed(() => props.disabled || props.loading || validating.value)
const visibleFields = computed(() => props.fields.filter(field => typeof field.visible === 'function' ? field.visible(model.value) : field.visible !== false))
const isDisabled = (field: FormField<Model>) => locked.value || (typeof field.disabled === 'function' ? field.disabled(model.value) : field.disabled === true)
function update(field: FormField<Model>, value: unknown) {
  if (!isDisabled(field)) model.value = { ...model.value, [field.prop]: value }
}
function control(field: FormField<Model>) {
  const value = model.value[field.prop]
  // 原生控件的联合 props 在适配层展开；调用方仍受字段类型约束。
  const common: Record<string, unknown> = { ariaLabel: field.label, ...('props' in field ? field.props : {}), disabled: isDisabled(field), 'onUpdate:modelValue': (next: unknown) => update(field, next) }
  if (field.type === 'input' || field.type === 'textarea') return h(ElInput, {
    ...common, type: field.type === 'textarea' ? 'textarea' : field.props?.type ?? 'text', modelValue: typeof value === 'string' ? value : '',
  })
  if (field.type === 'number') return h(ElInputNumber, { ...common, modelValue: typeof value === 'number' ? value : undefined })
  if (field.type === 'switch') return h(ElSwitch, { ...common, modelValue: value === true })
  if (field.type === 'select') return h(ElSelect, { ...common, modelValue: typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' ? value : undefined, multiple: false }, () =>
    field.options.map(option => h(ElOption, { key: String(option.value), label: option.label, value: option.value as string | number | boolean, disabled: option.disabled })))
  if (field.type === 'date') return h(DateControl, { ...common, type: 'date', modelValue: value instanceof Date || typeof value === 'string' ? value : undefined })
  return null
}
const FieldControl = ({ field }: { field: FormField<Model> }) => control(field)
async function validate() {
  try { return await form.value?.validate() ?? false } catch { return false }
}
async function submit() {
  if (locked.value || validating.value) return false
  validating.value = true
  try {
    if (!await validate() || props.disabled || props.loading) return false
    emit('submit', model.value)
    return true
  } finally { validating.value = false }
}
function reset(values?: Model) {
  if (locked.value) return
  model.value = structuredClone(toRaw(values ?? props.defaults?.() ?? baseline))
  void nextTick(() => form.value?.clearValidate())
  emit('reset', model.value)
}
defineExpose<FormHandle<Model>>({ validate, submit, reset, clearValidate: () => form.value?.clearValidate() })
</script>

<template>
  <el-form ref="form" v-bind="{ labelPosition: 'top', ...options, ...$attrs }" :model="model" :rules="rules" :disabled="locked"
    class="app-form" :class="{ 'app-form--inline': inline }" @submit.prevent="submit">
    <div class="app-form-fields" :style="{ '--app-form-columns': String(columns) }">
      <el-form-item v-for="field in visibleFields" :key="field.prop" :prop="field.prop" :label="field.label" :rules="field.rules"
        :style="{ gridColumn: field.span ? `span ${Math.min(field.span, columns)}` : undefined }">
        <slot :name="`field-${field.prop}`" :model="model" :field="field" :value="model[field.prop]" :update="value => update(field, value)" :disabled="isDisabled(field)">
          <FieldControl :field="field" />
        </slot>
        <p v-if="field.hint" class="field-hint">{{ field.hint }}</p>
      </el-form-item>
      <div v-if="showActions" class="app-form-actions">
        <slot name="actions" :submit="submit" :reset="reset" :disabled="locked">
          <el-button type="primary" native-type="submit" :loading="loading || validating" :disabled="disabled">{{ submitText }}</el-button>
          <el-button v-if="showReset" :disabled="locked" @click="reset()">{{ resetText }}</el-button>
        </slot>
      </div>
    </div>
  </el-form>
</template>

<style scoped>
.app-form-fields { display: grid; grid-template-columns: repeat(var(--app-form-columns), minmax(0, 1fr)); column-gap: var(--app-form-gap); }
.app-form-fields :deep(.el-input-number), .app-form-fields :deep(.el-select), .app-form-fields :deep(.el-date-editor) { width: 100%; }
.app-form-actions { grid-column: 1 / -1; display: flex; align-items: center; gap: var(--app-space-xs); }
.app-form-actions :deep(.el-button + .el-button) { margin-left: 0; }
.field-hint { width: 100%; font-size: 12px; line-height: 1.6; color: var(--el-text-color-secondary); margin: 6px 0 0; }
.app-form--inline .app-form-fields { display: flex; flex-wrap: wrap; gap: 0 var(--app-space-md); align-items: flex-start; }
.app-form--inline .el-form-item { width: 200px; margin-bottom: 0; }
.app-form--inline .app-form-actions { align-self: flex-end; padding-bottom: 0; }
@media (max-width: 640px) { .app-form-fields { grid-template-columns: minmax(0, 1fr); } .app-form-fields > * { grid-column: 1 / -1 !important; } .app-form--inline .app-form-fields { display: grid; gap: var(--app-space-md); } .app-form--inline .el-form-item { width: 100%; } }
</style>
