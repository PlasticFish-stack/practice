<script setup lang="ts">
import { ref, shallowRef } from 'vue'
import '../editor.css'
import AppForm from '@/components/AppForm/AppForm.vue'
import type { FormField } from '@/components/AppForm/types'
import { systemApi } from '@/api/system'
import { useAuthStore } from '@/stores/auth'
import { PERMISSIONS } from '@/auth/permissions'
import type { RoleRecord, RoleDraft, SystemCatalog } from '@/types/system'
import PermissionPicker from './PermissionPicker.vue'

const props = defineProps<{ role: RoleRecord | null; catalog: SystemCatalog }>()
const emit = defineEmits<{ close: []; saved: [] }>()
const auth = useAuthStore()
const saving = shallowRef(false)
const error = shallowRef('')
const form = ref<RoleDraft>(props.role ? { code: props.role.code, name: props.role.name, description: props.role.description, enabled: props.role.enabled,
  permissions: [...props.role.permissions], version: props.role.version } : { code: '', name: '', description: '', enabled: true, permissions: [] })
const fields: FormField<RoleDraft>[] = [
  { prop: 'name', label: '角色名称', type: 'input', props: { maxlength: 50 }, rules: [{ required: true, whitespace: true, message: '请输入角色名称', trigger: 'blur' }] },
  { prop: 'code', label: '角色编码', type: 'input', disabled: !!props.role, props: { maxlength: 40 }, rules: [{ required: true, pattern: /^[a-z][a-z0-9_-]{1,39}$/, message: '请输入 2–40 位小写字母、数字、下划线或短横线', trigger: 'blur' }] },
  { prop: 'description', label: '描述', type: 'textarea', props: { maxlength: 200, rows: 2 }, span: 2 },
  { prop: 'enabled', label: '启用角色', type: 'switch', hint: '停用后，已分配用户将失去此角色提供的权限。', span: 2 },
  { prop: 'permissions', label: '权限分配', type: 'slot', span: 2 },
]
async function save() {
  if (saving.value || !auth.can(PERMISSIONS.roleWrite)) return
  saving.value = true; error.value = ''
  try { await systemApi.saveRole(props.role?.id, form.value); emit('saved') }
  catch (cause) { error.value = cause instanceof Error ? cause.message : '保存失败，请重试' }
  finally { saving.value = false }
}
</script>

<template>
  <el-dialog class="system-editor" :model-value="true" :title="role ? '编辑角色' : '新增角色'" width="min(640px, calc(100vw - 32px))"
    :close-on-click-modal="!saving" :close-on-press-escape="!saving" :show-close="!saving" @update:model-value="!saving && emit('close')">
    <el-alert v-if="error" :title="error" type="error" :closable="false" role="alert" class="editor-error" />
    <AppForm v-model="form" :fields="fields" :columns="2" :loading="saving" :disabled="!auth.can(PERMISSIONS.roleWrite)" @submit="save">
      <template #field-permissions="{ disabled }"><PermissionPicker v-model="form.permissions" :options="catalog.permissions" :disabled="disabled" /></template>
      <template #actions="{ disabled }"><el-button type="primary" native-type="submit" :loading="saving" :disabled="disabled">保存</el-button><el-button :disabled="saving" @click="emit('close')">取消</el-button></template>
    </AppForm>
  </el-dialog>
</template>

<style scoped>.editor-error { margin-bottom: var(--app-space-md); }</style>
