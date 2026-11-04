<script setup lang="ts">
import { computed, ref, shallowRef } from 'vue'
import AppTable from '../../src/components/AppTable/AppTable.vue'
import type { ColumnOptions } from '../../src/components/AppTable/types'
type Row = { id: number; name: string }
const count = ref(499)
const paged = ref(false)
const mode = ref<boolean | 'auto'>('auto')
const unsupported = ref(false)
const nativeAttrs = ref(false)
const hideId = ref(false)
const removed = ref(false)
const renamed = ref(false)
const selected = shallowRef(0)
const selectedNames = shallowRef('')
const tableOptions = { rowKey: 'id' }
const rows = computed(() => Array.from({ length: count.value }, (_, id) => ({ id, name: `${renamed.value && id === 0 ? '更新-' : ''}记录-${id}` })).filter(row => !removed.value || row.id !== 0))
const columns = computed<ColumnOptions<Row>[]>(() => [
  { type: 'selection', width: 48 },
  { prop: 'id', label: '编号', width: 100, sortable: true, hidden: hideId.value },
  { prop: 'name', label: '名称', minWidth: 200, sortable: true, copyText: row => `名称：${row.name}`, ...(unsupported.value ? { filters: [{ text: '测试', value: 'test' }] } : {}) },
])
</script>
<template>
  <div>
    <button @click="count = 500">500行</button><button @click="count = 499">499行</button><button @click="count = 10000">万行</button>
    <button @click="paged = !paged">分页开关</button><button @click="mode = false">关闭虚拟</button><button @click="mode = true">强制虚拟</button><button @click="mode = 'auto'">自动模式</button>
    <button @click="unsupported = !unsupported">筛选配置开关</button>
    <button @click="nativeAttrs = !nativeAttrs">原生属性开关</button><button @click="hideId = !hideId">隐藏编号</button><button @click="removed = true">删除首行</button>
    <button @click="renamed = true">更新首行</button>
    <output aria-label="选中数量">{{ selected }}</output>
    <output aria-label="选中名称">{{ selectedNames }}</output>
    <AppTable table-key="virtual.fixture" v-bind="nativeAttrs ? { stripe: true } : {}" :rows="rows" :column-options="columns" :virtual="mode" :virtual-height="320" :table-options="tableOptions"
      :pagination="paged ? { page: 1, pageSize: count, total: count } : undefined" @selection-change="selected = $event.length; selectedNames = $event.map(row => row.name).join(',')">
      <template #cell-name="{ row }"><span>名称：{{ row.name }}</span></template>
    </AppTable>
  </div>
</template>
