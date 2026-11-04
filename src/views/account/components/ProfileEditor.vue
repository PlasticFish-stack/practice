<script setup lang="ts">
import { ref, shallowRef } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { profileFromUser, validateProfile } from '@/auth/profile'
import AppForm from '@/components/AppForm/AppForm.vue'
import type { FormField } from '@/components/AppForm/types'
import type { UserProfile } from '@/auth/profile'
import UserAvatar from '@/components/UserAvatar.vue'

const auth = useAuthStore()
const emit = defineEmits<{ saved: []; cancel: [] }>()
const form = ref(profileFromUser(auth.user))
const fields: FormField<UserProfile>[] = [
  { prop: 'displayName', label: '昵称', type: 'input', span: 2, props: { maxlength: 40 }, rules: [{ required: true, whitespace: true, message: '请输入昵称', trigger: 'blur' }] },
  { prop: 'email', label: '邮箱', type: 'input', span: 2, props: { type: 'email', maxlength: 254 }, rules: [{ type: 'email', message: '请输入有效的邮箱地址', trigger: 'blur' }] },
  { prop: 'department', label: '部门', type: 'input', props: { maxlength: 80 } },
  { prop: 'title', label: '职位', type: 'input', props: { maxlength: 80 } },
  { prop: 'phone', label: '联系电话', type: 'input', span: 2, props: { type: 'tel', maxlength: 32 } },
  { prop: 'bio', label: '个人简介', type: 'textarea', span: 2, props: { rows: 3, maxlength: 300, showWordLimit: true } },
  { prop: 'avatarUrl', label: '头像地址', type: 'input', span: 2, props: { maxlength: 2048, placeholder: 'HTTPS 图片地址或本站图片路径' } },
]
const error = shallowRef('')
async function save() {
  error.value = validateProfile(form.value) || ''
  if (error.value) return
  try {
    const user = await auth.saveProfile({ ...form.value })
    form.value = profileFromUser(user)
    emit('saved')
  } catch (cause) { error.value = cause instanceof Error ? cause.message : '保存失败，请稍后重试' }
}
function reset() {
  error.value = ''
}
</script>

<template>
  <section class="profile-editor">
      <div class="editor-heading"><h3>编辑个人资料</h3><el-button :disabled="auth.savingProfile" @click="emit('cancel')">取消编辑</el-button></div>
      <p class="settings-description">完善个人资料，让团队更容易认识你。</p>
      <el-alert v-if="error" :title="error" type="error" :closable="false" role="alert" />
      <div class="settings-grid">
        <AppForm v-model="form" :fields="fields" :columns="2" :loading="auth.savingProfile"
          :defaults="() => profileFromUser(auth.user)" submit-text="更新个人资料" @submit="save" @reset="reset" />
        <div class="avatar-preview"><h3>头像预览</h3><UserAvatar :user="auth.user ? { ...auth.user, ...form } : null" :size="120" /><p>未设置头像时显示昵称首字。<br>图片不可用时自动使用默认头像。</p></div>
      </div>
  </section>
</template>

<style scoped>
.profile-editor { min-width: 0; }
.editor-heading { display: flex; align-items: center; justify-content: space-between; gap: var(--app-space-md); }
.editor-heading h3 { font-size: 16px; margin: 0; }
.settings-description { color: var(--el-text-color-secondary); font-size: 14px; margin-bottom: var(--app-space-lg); }
.settings-grid { display: grid; grid-template-columns: minmax(0, 1fr) 160px; gap: var(--app-space-lg); }
.avatar-preview { text-align: center; padding-top: 4px; }
.avatar-preview h3 { font-size: 14px; margin: 0 0 24px; font-weight: 500; }
.avatar-preview p { color: var(--el-text-color-secondary); font-size: 12px; line-height: 1.8; }
.el-alert { margin-bottom: 20px; }
@media (max-width: 1100px) { .settings-grid { grid-template-columns: 1fr; } .avatar-preview { grid-row: 1; text-align: left; display: none; } }
</style>
