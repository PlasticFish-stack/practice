<script setup lang="ts">
import { GetDevices } from '@/api/device';
import Devices from '@/components/Devices/Devices.vue';
import type { Device } from '@/types/device';
import { ref } from 'vue';

const deviceList = ref<Device[]>([])

async function getDevices(){
  const res = await GetDevices()
  deviceList.value = res.data.list
  
  
}
</script>

<template>
  <div>
    <Devices :devices="deviceList"/>
    <el-button @click="getDevices()"></el-button>
  </div>
</template>

<style scoped lang="scss">
</style>