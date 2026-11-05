<script setup lang="ts">
import { ref, shallowRef } from 'vue';
import '../editor.css';
import AppForm from '@/components/AppForm/AppForm.vue';
import type { FormField } from '@/components/AppForm/types';
import { systemApi } from '@/api/system';
import { useAuthStore } from '@/stores/auth';
import { PERMISSIONS } from '@/auth/permissions';
import { DEFAULT_NAVIGATION } from '@/auth/navigation';
import type { MenuSetting, MenuDraft, SystemCatalog } from '@/types/system';
import PermissionPicker from './PermissionPicker.vue';

const props = defineProps<{ menu: MenuSetting; catalog: SystemCatalog }>();
const emit = defineEmits<{ close: []; saved: [] }>();
const auth = useAuthStore();
const saving = shallowRef(false);
const error = shallowRef('');
const { title, icon, order, visible, permissions, version } = props.menu;
const form = ref<MenuDraft>({
  title,
  icon,
  order,
  visible,
  permissions: [...permissions],
  version,
});
const required =
  DEFAULT_NAVIGATION.find((item) => item.routeName === props.menu.routeName)?.permissions ?? [];
const fields: FormField<MenuDraft>[] = [
  {
    prop: 'title',
    label: '菜单名称',
    type: 'input',
    props: { maxlength: 40 },
    rules: [{ required: true, whitespace: true, message: '请输入菜单名称', trigger: 'blur' }],
  },
  {
    prop: 'icon',
    label: '图标',
    type: 'select',
    options: props.catalog.icons.map((value) => ({ value, label: value })),
  },
  {
    prop: 'order',
    label: '排序',
    type: 'number',
    props: { min: 0, max: 9999, precision: 0 },
    rules: [{ required: true, type: 'number', message: '请输入排序', trigger: 'change' }],
  },
  {
    prop: 'visible',
    label: '显示菜单',
    type: 'switch',
    disabled: props.menu.protected,
    hint: '隐藏入口不会撤销用户的接口权限。',
  },
  { prop: 'permissions', label: '访问权限（全部满足）', type: 'slot', span: 2 },
];
async function save() {
  if (saving.value || !auth.can(PERMISSIONS.menuWrite)) return;
  saving.value = true;
  error.value = '';
  try {
    await systemApi.saveMenu(props.menu.routeName, form.value);
    emit('saved');
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '保存失败，请重试';
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <el-dialog
    class="system-editor"
    :model-value="true"
    title="编辑菜单"
    width="min(640px, calc(100vw - 32px))"
    :close-on-click-modal="!saving"
    :close-on-press-escape="!saving"
    :show-close="!saving"
    @update:model-value="!saving && emit('close')"
  >
    <p class="route-hint">页面地址：{{ menu.path }}</p>
    <el-alert
      v-if="error"
      :title="error"
      type="error"
      :closable="false"
      role="alert"
      class="editor-error"
    />
    <AppForm
      v-model="form"
      :fields="fields"
      :columns="2"
      :loading="saving"
      :disabled="!auth.can(PERMISSIONS.menuWrite)"
      @submit="save"
    >
      <template #field-permissions="{ disabled }">
        <PermissionPicker
          v-model="form.permissions"
          :options="catalog.permissions"
          :required="required"
          :disabled="disabled || menu.protected"
        />
      </template>
      <template #actions="{ disabled }">
        <el-button
          type="primary"
          native-type="submit"
          :loading="saving"
          :disabled="disabled"
        >
          保存
        </el-button>
        <el-button
          :disabled="saving"
          @click="emit('close')"
        >
          取消
        </el-button>
      </template>
    </AppForm>
  </el-dialog>
</template>

<style scoped>
.editor-error {
  margin-bottom: var(--app-space-md);
}
.route-hint {
  margin-top: 0;
  color: var(--app-color-text-secondary);
  font-size: 13px;
  overflow-wrap: anywhere;
}
</style>
