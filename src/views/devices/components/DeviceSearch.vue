<script setup lang="ts">
import { ref } from 'vue';
import type { Device, DeviceSearch } from '@/types/device';
import type { FormField } from '@/components/AppForm/types';
import AppForm from '@/components/AppForm/AppForm.vue';

type Filters = { id: string; name: string; status: Device['status'] | '' };
const emit = defineEmits<{ search: [params: DeviceSearch] }>();
const defaults = (): Filters => ({ id: '', name: '', status: '' });
const form = ref<Filters>(defaults());
const fields: FormField<Filters>[] = [
  {
    prop: 'id',
    label: '设备 ID',
    type: 'input',
    props: { clearable: true, placeholder: '输入设备 ID' },
  },
  {
    prop: 'name',
    label: '设备名称',
    type: 'input',
    props: { clearable: true, placeholder: '输入设备名称' },
  },
  {
    prop: 'status',
    label: '设备状态',
    type: 'select',
    props: { clearable: true, placeholder: '全部状态' },
    options: [
      { label: '全部状态', value: '' },
      { label: '在线', value: 'online' },
      { label: '离线', value: 'offline' },
      { label: '异常', value: 'error' },
    ],
  },
];
function search() {
  emit('search', {
    id: form.value.id.trim() || undefined,
    name: form.value.name.trim() || undefined,
    status: form.value.status || undefined,
  });
}
</script>

<template>
  <section class="device-search-card">
    <AppForm
      v-model="form"
      :fields="fields"
      :defaults="defaults"
      inline
      submit-text="搜索"
      @submit="search"
      @reset="search"
    />
  </section>
</template>

<style scoped>
.device-search-card {
  padding: var(--app-card-padding);
  margin-bottom: var(--app-space-lg);
  background: var(--el-bg-color);
  border: var(--app-border-secondary);
  border-radius: var(--app-radius-lg);
  box-shadow: var(--app-shadow-card);
}
</style>
