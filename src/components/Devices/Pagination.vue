<script setup lang="ts">
import type { DeviceSearch } from '@/types/device';
import { watch } from 'vue';

const props = defineProps<{
    syncing: boolean
}>()

const emit = defineEmits<{
    (e: 'searchDevices', searchParam: DeviceSearch): void
}>()

const currentPage = defineModel<number>('currentPage')
const currentPageSize = defineModel<number>('currentPageSize')
const total = defineModel<number>('total')

watch(() => [currentPage.value, currentPageSize.value], ([page, pageSize]) => {
    if(props.syncing) return
    if(page === undefined || pageSize === undefined || pageSize <= 0) return
    const maxPage = Math.max(1, (Math.ceil(total.value ?? 0) / pageSize))
    if (page < 1 || page > maxPage) return
    emit('searchDevices', {
        page,
        pageSize
    })
}, {
    flush: 'post'
})
</script>

<template>
    <el-pagination layout="total, sizes, prev, pager, next, jumper" v-model:current-page="currentPage"
        v-model:page-size="currentPageSize" background :page-sizes="[10, 50, 100, 200, 400]" :total="total" />
</template>

<style scoped lang="scss"></style>
