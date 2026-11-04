<script setup lang="ts">
import { ref, shallowRef, watch } from 'vue'
import { updateDevice } from '@/api/device'
import { useAuthStore } from '@/stores/auth'
import { PERMISSIONS } from '@/auth/permissions'
import type { Device } from '@/types/device'
import type { FormField } from '@/components/AppForm/types'
import AppForm from '@/components/AppForm/AppForm.vue'

type EditDevice = Pick<Device, 'name' | 'brightness'>
const open = defineModel<boolean>({ required: true })
const props = defineProps<{ device: Device | null }>()
const emit = defineEmits<{ saved: [] }>()
const auth = useAuthStore()
const form = ref<EditDevice>({ name: '', brightness: 0 })
const saving = shallowRef(false)
const error = shallowRef('')
const fields: FormField<EditDevice>[] = [
  { prop: 'name', label: '名称', type: 'input', props: { maxlength: 100 }, rules: [{ required: true, whitespace: true, message: '请输入设备名称', trigger: 'blur' }] },
  { prop: 'brightness', label: '亮度', type: 'number', props: { min: 0, max: 100 }, rules: [{ required: true, type: 'number', min: 0, max: 100, message: '亮度应在 0–100 之间', trigger: 'change' }] },
]
watch(open, value => {
  if (value && props.device) {
    form.value = { name: props.device.name, brightness: props.device.brightness }
    error.value = ''
  }
})
async function save() {
  if (saving.value || !props.device) return
  if (!auth.can(PERMISSIONS.deviceUpdate)) { error.value = '没有设备编辑权限'; return }
  saving.value = true
  error.value = ''
  try {
    await updateDevice(props.device.id, { ...form.value, name: form.value.name.trim(), version: props.device.version })
    open.value = false
    emit('saved')
  } catch (cause) { error.value = cause instanceof Error ? cause.message : '保存失败，请重试' }
  finally { saving.value = false }
}
</script>

<template>
  <el-dialog v-model="open" title="编辑设备" width="420px" destroy-on-close :close-on-click-modal="!saving" :close-on-press-escape="!saving" :show-close="!saving">
    <el-alert v-if="error" :title="error" type="error" :closable="false" role="alert" />
    <AppForm v-model="form" :fields="fields" :loading="saving" @submit="save">
      <template #actions="{ disabled }"><el-button type="primary" native-type="submit" :loading="saving">保存</el-button><el-button :disabled="disabled" @click="open = false">取消</el-button></template>
    </AppForm>
  </el-dialog>
</template>
