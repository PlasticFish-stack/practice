<script setup lang="ts">
import { computed } from 'vue'
import { useAuthStore } from '@/stores/auth'
import type { Permission } from '@/auth/permissions'
import type { SystemCatalog } from '@/types/system'

const model = defineModel<Permission[]>({ required: true })
const props = defineProps<{ options: SystemCatalog['permissions']; disabled?: boolean; required?: readonly Permission[] }>()
const auth = useAuthStore()
const groups = computed(() => [...new Set(props.options.map(item => item.group))].map(title => ({
  title, options: props.options.filter(item => item.group === title),
})))
function update(values: (string | number | boolean)[]) {
  let next = values as Permission[]
  const removed = model.value.filter(code => !next.includes(code))
  next = next.filter(code => !props.options.find(item => item.code === code)?.requires?.some(required => removed.includes(required)))
  for (const code of [...next]) {
    for (const required of props.options.find(item => item.code === code)?.requires ?? []) if (!next.includes(required)) next.push(required)
  }
  model.value = [...new Set([...(props.required ?? []), ...next])]
}
</script>

<template>
  <div class="permission-picker">
    <el-checkbox-group :model-value="model" :disabled="disabled" @change="update">
      <section v-for="group in groups" :key="group.title" class="permission-group">
        <h3>{{ group.title }}</h3>
        <el-checkbox v-for="item in group.options" :key="item.code" :value="item.code"
          :disabled="required?.includes(item.code) || !auth.user?.permissions.includes(item.code)">{{ item.label }}</el-checkbox>
      </section>
    </el-checkbox-group>
    <p>操作权限会关联对应的查看权限。</p>
  </div>
</template>

<style scoped>
.permission-picker { width: 100%; }
.permission-group { padding: 8px 12px; border: var(--app-border-secondary); border-radius: var(--app-radius-base); margin-bottom: 8px; }
.permission-group h3 { font-size: 13px; line-height: 1.5; margin: 0 0 4px; color: var(--app-color-text-secondary); }
.permission-picker p { font-size: 12px; line-height: 1.6; margin: 0; color: var(--app-color-text-tertiary); }
</style>
