import type { Device, Pagination } from "@/types/device";
import { api } from ".";

export function GetDevices()  {
    return api.get<Pagination<Device[]>>('/api/devices', {
        page: 1,
        pageSize: 10,
        keyword: '',
        status: 'offline',
    })
}