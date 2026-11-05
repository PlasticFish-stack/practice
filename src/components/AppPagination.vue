<script setup lang="ts">
import { useMediaQuery } from '@vueuse/core';

const compact = useMediaQuery('(max-width: 640px)');
const props = withDefaults(
  defineProps<{
    total: number;
    syncing?: boolean;
    disabled?: boolean;
    pageSizes?: number[];
  }>(),
  { syncing: false, disabled: false, pageSizes: () => [10, 20, 50, 100] },
);
const emit = defineEmits<{ change: [params: { page: number; pageSize: number }] }>();
const currentPage = defineModel<number>('currentPage', { required: true });
const currentPageSize = defineModel<number>('currentPageSize', { required: true });

// 只响应控件交互；父级写回服务器分页数据不会再次发起查询。
function change(page: number, pageSize: number) {
  if (props.syncing || props.disabled || pageSize <= 0) return;
  if (page === currentPage.value && pageSize === currentPageSize.value) return;
  currentPage.value = page;
  currentPageSize.value = pageSize;
  emit('change', { page, pageSize });
}
</script>

<template>
  <el-pagination
    :current-page="currentPage"
    :page-size="currentPageSize"
    :total="total"
    :disabled="disabled"
    :page-sizes="pageSizes"
    :layout="compact ? 'prev, pager, next' : 'total, sizes, prev, pager, next, jumper'"
    :size="compact ? 'small' : 'default'"
    :pager-count="compact ? 5 : 7"
    background
    @update:current-page="(page) => change(page, currentPageSize)"
    @update:page-size="(size) => change(1, size)"
  />
</template>
