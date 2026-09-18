export interface Device {
  id: string
  name: string
  workshopId: string
  status: 'online' | 'offline' | 'error'
  brightness: number
  temperature: number
  version: number
  updatedAt: string
}

export interface Pagination<T> {
  list: T
  page: number
  pageSize: number
  total: number
}