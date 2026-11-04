import { api } from './index'
import type { UserRecord, RoleRecord, MenuSetting, UserDraft, RoleDraft, MenuDraft, SystemCatalog, SystemQuery } from '@/types/system'
import type { Pagination } from '@/types/device'

const base = '/api/system/'
export const systemApi = {
  async users(query: SystemQuery, signal?: AbortSignal) { return (await api.get<Pagination<UserRecord[]>>(base + 'users', query, { signal })).data },
  async roles(query: SystemQuery, signal?: AbortSignal) { return (await api.get<Pagination<RoleRecord[]>>(base + 'roles', query, { signal })).data },
  async menus(signal?: AbortSignal) { return (await api.get<MenuSetting[]>(base + 'menus', undefined, { signal })).data },
  async catalog(signal?: AbortSignal) { return (await api.get<SystemCatalog>(base + 'catalog', undefined, { signal })).data },
  async saveUser(id: string | undefined, data: UserDraft) {
    return (await api.request<UserRecord>({ url: base + 'users' + (id ? '/' + encodeURIComponent(id) : ''), method: id ? 'PATCH' : 'POST', data })).data
  },
  async saveRole(id: string | undefined, data: RoleDraft) {
    return (await api.request<RoleRecord>({ url: base + 'roles' + (id ? '/' + encodeURIComponent(id) : ''), method: id ? 'PATCH' : 'POST', data })).data
  },
  async saveMenu(id: string, data: MenuDraft) {
    return (await api.request<MenuSetting>({ url: base + 'menus/' + encodeURIComponent(id), method: 'PATCH', data })).data
  },
  async deleteUser(id: string, version: number) { await api.request({ url: base + 'users/' + encodeURIComponent(id), method: 'DELETE', data: { version } }) },
  async deleteRole(id: string, version: number) { await api.request({ url: base + 'roles/' + encodeURIComponent(id), method: 'DELETE', data: { version } }) },
}
