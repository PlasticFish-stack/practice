import type { Device, DeviceSearch, Pagination } from "@/types/device";
import { api } from ".";

export function GetDevices(params?: DeviceSearch) {
    return api.get<Pagination<Device[]>>('/api/devices', params ?? {})
}