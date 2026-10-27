<script setup lang="ts">
import { GetDevices } from '@/api/device';
import Search from './Search.vue';
import Table from './Table.vue';
import type { Device, DeviceSearch } from '@/types/device.ts';
import { computed, h, nextTick, ref } from 'vue';
import Pagination from './Pagination.vue';
import type { ColumnOptions, TableOptions } from './types.ts';
import Status from '../Form/Status/Status.vue';

const deviceList = ref<Device[]>([])

const currentPage = ref(1)

const currentPageSize = ref(10)

const total = ref(0)

const syncing = ref(false)

const tableLoading = ref(false)

const tableOptions: TableOptions = {
    stripe: true
}

function statusSelect(status: string) {
    if (status === 'online') return {
        color: 'green',
        ripple: false
    }
    if (status === 'offline') return {
        color: 'yellow',
        ripple: false
    }
    if (status === 'error') return {
        color: 'red',
        ripple: true
    }
    return {}
}

const tableColumnOptions: ColumnOptions<Device>[] = [
    // {
    //     expand: true,
    //     slot: {
    //         default: () => h('div', 'foo')
    //         // header: () => h('div', 'foo')
    //     }
    // },
    {
        prop: 'id',
        label: 'id',
        search: true,
        formatter: (row) => {
            return row.id
        }
    }, {
        prop: 'name',
        label: 'name',
        edit: {
            type: 'string',
            onEdit(row, value) {
                row['name'] = value
            },
        }

    }, {
        prop: 'workshopId',
        label: 'workshopId'
    }, {
        prop: 'status',
        label: 'status',
        slot: {
            default: (d) => h(Status, { ...statusSelect(d.row.status), size: 8, sizeType: 'px', })
        }
    }, {
        prop: 'brightness',
        label: 'brightness',
        edit: {
            type: 'number',
            editProps: {
                step: 5
            },
            onEdit(row, value) {
                if (value) {
                    row['brightness'] = value
                }
            },
        }

    }, {
        prop: 'temperature',
        label: 'temperature'
    }, {
        prop: 'version',
        label: 'version'
    }, {
        prop: 'updatedAt',
        label: 'updatedAt',
        // expand: true,
        slot: {
            // default: () => 'default slot',
            header: () => h('div', 'foo')
        }
    }
]

const searchOptions = computed(() => {
    return tableColumnOptions.filter((item) => {
        return item.search
    })
})

const pageParams = computed(() => {
    const val = {
        page: currentPage.value,
        pageSize: currentPageSize.value
    }
    return val
})

let requestCount = 0

async function getDevices(searchParam: DeviceSearch) {
    const params = { ...pageParams.value, ...searchParam }
    const reqCount = ++requestCount
    try {
        tableLoading.value = true
        const { data } = await GetDevices(params)
        if (reqCount !== requestCount) return
        syncing.value = true
        try {
            deviceList.value = data.list
            total.value = data.total
            currentPage.value = data.page
            currentPageSize.value = data.pageSize
            await nextTick()
        } finally {
            syncing.value = false
        }

    } catch (e) {

    } finally {
        syncing.value = false
        tableLoading.value = false

    }
}

getDevices({})
</script>

<template>
    <div>
        <Search :search-options="searchOptions" @searchDevices="getDevices" />
        <Table :table-options="tableOptions" :columnOptions="tableColumnOptions" :devices="deviceList"
            :loading="tableLoading" />
        <Pagination v-model:current-page="currentPage" v-model:current-page-size="currentPageSize" v-model:total="total"
            :syncing="syncing" @searchDevices="getDevices" />
        <button @click="() => {
            console.log(deviceList, '_ - - - _');

        }"></button>
    </div>
</template>

<style scoped lang="scss"></style>