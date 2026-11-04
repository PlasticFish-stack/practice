<script setup lang="ts">
import { computed, ref, shallowRef } from 'vue'
import '../editor.css'
import AppForm from '@/components/AppForm/AppForm.vue'
import type { FormField } from '@/components/AppForm/types'
import { systemApi } from '@/api/system'
import { useAuthStore } from '@/stores/auth'
import { PERMISSIONS } from '@/auth/permissions'
import type { UserRecord, UserDraft, RoleRecord } from '@/types/system'

const props = defineProps<{ user: UserRecord | null; roles: RoleRecord[] }>()
const emit = defineEmits<{ close: []; saved: [] }>()
const auth = useAuthStore()
const saving = shallowRef(false)
const error = shallowRef('')
const form = ref<UserDraft>({ username: '', displayName: '', email: '', roleIds: [], enabled: true, password: '',
  ...(props.user ? { username: props.user.username, displayName: props.user.displayName, email: props.user.email,
    enabled: props.user.enabled, version: props.user.version, roleIds: [...props.user.roleIds] } : {}) })
// 明确选取写入字段，列表记录中的 id 不进入修改请求。
const fields = computed<FormField<UserDraft>[]>(() => [
  { prop: 'username', label: '用户名', type: 'input', disabled: !!props.user, props: { maxlength: 40 }, rules: [{ required: true, pattern: /^[A-Za-z][A-Za-z0-9_-]{2,39}$/, message: '请输入 3–40 位用户名，以字母开头', trigger: 'blur' }] },
  { prop: 'displayName', label: '显示名称', type: 'input', props: { maxlength: 40 }, rules: [{ required: true, whitespace: true, message: '请输入显示名称', trigger: 'blur' }] },
  { prop: 'email', label: '邮箱', type: 'input', props: { maxlength: 254 }, rules: [{ type: 'email', message: '请输入有效邮箱', trigger: 'blur' }] },
  { prop: 'password', label: props.user ? '重置密码' : '初始密码', type: 'input', props: { type: 'password', showPassword: true, autocomplete: 'new-password', maxlength: 128 },
    hint: props.user ? '留空则保留原密码；新密码至少 12 位，包含字母和数字。' : '至少 12 位，包含字母和数字。',
    rules: [{ required: !props.user, message: '请输入初始密码', trigger: 'blur' }, { validator: (_, value, callback) => callback(!value || (value.length >= 12 && /[A-Za-z]/.test(value) && /[0-9]/.test(value)) ? undefined : new Error('密码至少 12 位，包含字母和数字')), trigger: 'blur' }] },
  { prop: 'roleIds', label: '角色', type: 'slot', span: 2 },
  { prop: 'enabled', label: '启用账号', type: 'switch', disabled: props.user?.id === auth.user?.id },
])
async function save() {
  if (saving.value || !auth.can(PERMISSIONS.userWrite)) return
  saving.value = true; error.value = ''
  try {
    const { username, displayName, email, roleIds, enabled, password, version } = form.value
    await systemApi.saveUser(props.user?.id, { username, displayName, email, roleIds, enabled, password, ...(version ? { version } : {}) })
    emit('saved')
  } catch (cause) { error.value = cause instanceof Error ? cause.message : '保存失败，请重试' }
  finally { saving.value = false }
}
</script>

<template>
  <el-dialog class="system-editor" :model-value="true" :title="user ? '编辑用户' : '新增用户'" width="min(600px, calc(100vw - 32px))"
    :close-on-click-modal="!saving" :close-on-press-escape="!saving" :show-close="!saving" @update:model-value="!saving && emit('close')">
    <el-alert v-if="error" :title="error" type="error" :closable="false" role="alert" class="editor-error" />
    <AppForm v-model="form" :fields="fields" :columns="2" :loading="saving" :disabled="!auth.can(PERMISSIONS.userWrite)" @submit="save">
      <template #field-roleIds="{ disabled }"><el-select v-model="form.roleIds" multiple placeholder="选择角色" :disabled="disabled" aria-label="角色">
        <el-option v-for="role in roles" :key="role.id" :label="role.name" :value="role.id"
          :disabled="!role.enabled || role.permissions.some(code => !auth.user?.permissions.includes(code))" />
      </el-select></template>
      <template #actions="{ disabled }"><el-button type="primary" native-type="submit" :loading="saving" :disabled="disabled">保存</el-button><el-button :disabled="saving" @click="emit('close')">取消</el-button></template>
    </AppForm>
  </el-dialog>
</template>

<style scoped>.editor-error { margin-bottom: var(--app-space-md); }</style>
