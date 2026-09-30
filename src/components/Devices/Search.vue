<script setup lang="ts" generic="T extends TableRow">
import type { DeviceSearch } from '@/types/device'
import { reactive, watch } from 'vue';
import type { TableRow } from './types';

const props = defineProps<{
    searchOptions: T
}>()

const emit = defineEmits<{
    (e: 'searchDevices', searchParam: DeviceSearch): void
}>()

console.log(props.searchOptions, "opt");


const searchForm = reactive({})

watch(() => props.searchOptions, (n) => {
    console.log(n, "nnn");
    if (Array.isArray(n)) {
        n.forEach((item) => {
            if ()
                searchForm[item]
        })
    }
}, {
    immediate: true
})
</script>

<template>
    <div>
        <el-form :model="searchForm" label-width="auto" id="search">
            <el-form-item label="Id">
                <el-input v-model="searchForm.id" />
            </el-form-item>
            <el-form-item label="Name">
                <el-input v-model="searchForm.name" />
            </el-form-item>
            <el-form-item label="WorkshopId">
                <el-input v-model="searchForm.workshopId" />
            </el-form-item>
            <el-form-item label="Status">
                <el-input v-model="searchForm.status" />
            </el-form-item>
            <el-form-item label="Brightness">
                <el-input v-model="searchForm.brightness" />
            </el-form-item>
            <el-form-item label="Temperature">
                <el-input v-model="searchForm.temperature" />
            </el-form-item>
            <el-form-item label="Version">
                <el-input v-model="searchForm.version" />
            </el-form-item>
            <el-form-item label="UpdatedAt">
                <el-input v-model="searchForm.updatedAt" />
            </el-form-item>
            <div class="btn">
                <el-button @click="emit('searchDevices', searchForm)">搜索</el-button>
                <el-button>重置</el-button>
            </div>
        </el-form>
    </div>
</template>

<style scoped lang="scss">
#search {
    display: grid;
    width: 100%;
    box-sizing: border-box;
    padding: 10px;
    grid-column-gap: 20px;
    grid-row-gap: 15px;
    grid-template-columns: repeat(3, 1fr);
    justify-self: start;

    :deep(.el-form-item) {
        margin-bottom: 0;
    }
}

.btn {
    display: flex;
    justify-content: right;
    align-items: center;
}
</style>