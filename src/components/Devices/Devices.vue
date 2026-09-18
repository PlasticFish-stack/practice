<script setup lang="ts">
import type { Device } from '@/types/device';
import { reactive, ref, watch } from 'vue';

const props = defineProps<{
    devices: Device[]
}>()

const devices: Device[] = reactive([])

const loading = ref(true)

watch(() => props.devices, (n) => {
    loading.value = true
    setTimeout(() => {
        devices.splice(0, devices.length)
        devices.push(...n)
        loading.value = false

    }, 2000)

}, {
    immediate: true
})
</script>

<template>
    <el-table v-loading="loading" :data="devices">
        <el-table-column prop="id" label="id" width="180" />
        <el-table-column prop="name" label="name" width="180" />
        <el-table-column prop="workshopId" label="workshopId" />
        <el-table-column prop="status" label="status" />
        <el-table-column prop="brightness" label="brightness" />
        <el-table-column prop="temperature" label="temperature" />
        <el-table-column prop="version" label="version" />
        <el-table-column prop="updatedAt" label="updatedAt" />
    </el-table>

</template>

<style scoped lang="scss"></style>