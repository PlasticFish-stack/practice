import type { Device, Pagination } from '../src/types/device.ts'

export const devices: Device[] = createDevicesData(60)

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function createDevicesData(quantity: number): Device[] {
  return Array.from({ length: quantity }, (_, index) => {
    const status = randomInt(0, 100)
    return {
      id: String(index + 1),
      name: `Lamp ${randomInt(0, 100) > 50 ? 'A' : 'B'}`,
      workshopId: `${randomInt(0, 100) > 50 ? 'A' : 'B'}${randomInt(0, 100) > 50 ? '1' : '2'}`,
      status: status > 60 ? 'online' : status > 30 ? 'offline' : 'error',
      brightness: randomInt(0, 100),
      temperature: Number((Math.random() * 20 + 30).toFixed(1)),
      version: randomInt(0, 5),
      updatedAt: new Date(Date.now() - randomInt(0, 100000)).toISOString(),
    }
  })
}

// 分页合法性由 HTTP 入口校验；此处只负责设备筛选及分页。
export function queryDevices(query: Record<string, string | undefined> = {}): Pagination<Device[]> {
  let result = devices
  for (const key of ['id', 'name', 'workshopId', 'status', 'updatedAt'] as const) {
    const value = query[key]
    if (value !== undefined && value !== '') {
      result = result.filter(item => item[key].toLowerCase().includes(value.toLowerCase()))
    }
  }
  for (const key of ['brightness', 'temperature', 'version'] as const) {
    const value = query[key]
    if (value !== undefined && value !== '') {
      result = result.filter(item => item[key] === Number(value))
    }
  }
  const page = Number(query.page || 1)
  const pageSize = Number(query.pageSize || 20)
  return {
    list: result.slice((page - 1) * pageSize, page * pageSize),
    page,
    pageSize,
    total: result.length,
  }
}
