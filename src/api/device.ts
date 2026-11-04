import type { Device, DeviceSearch, Pagination } from "@/types/device";
import { api } from ".";

export function GetDevices(params?: DeviceSearch, signal?: AbortSignal) {
    return api.get<Pagination<Device[]>>('/api/devices', params ?? {}, { signal })
}
export function updateDevice(id: string, data: Pick<Device, 'name' | 'brightness' | 'version'>) {
  return api.request<Device>({ url: '/api/devices/' + encodeURIComponent(id), method: 'PATCH', data })
}
