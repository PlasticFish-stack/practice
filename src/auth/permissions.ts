import type { MenuSetting } from '../types/system.ts'

export const PERMISSIONS = {
  deviceRead: 'devices:read',
  deviceUpdate: 'devices:update',
  playgroundRead: 'playground:read',
  userRead: 'system:users:read',
  userWrite: 'system:users:write',
  roleRead: 'system:roles:read',
  roleWrite: 'system:roles:write',
  menuRead: 'system:menus:read',
  menuWrite: 'system:menus:write',
} as const

export type Permission = typeof PERMISSIONS[keyof typeof PERMISSIONS]
export type PermissionRequirement = Permission | readonly Permission[]

export const PERMISSION_CATALOG: readonly { code: Permission; label: string; group: string; requires?: readonly Permission[] }[] = [
  { code: PERMISSIONS.deviceRead, label: '查看设备', group: '设备管理' },
  { code: PERMISSIONS.deviceUpdate, label: '编辑设备', group: '设备管理', requires: [PERMISSIONS.deviceRead] },
  { code: PERMISSIONS.playgroundRead, label: '访问开发演示', group: '开发演示' },
  { code: PERMISSIONS.userRead, label: '查看用户', group: '用户管理' },
  { code: PERMISSIONS.userWrite, label: '管理用户', group: '用户管理', requires: [PERMISSIONS.userRead] },
  { code: PERMISSIONS.roleRead, label: '查看角色', group: '角色管理' },
  { code: PERMISSIONS.roleWrite, label: '管理角色及权限', group: '角色管理', requires: [PERMISSIONS.roleRead] },
  { code: PERMISSIONS.menuRead, label: '查看菜单配置', group: '菜单管理' },
  { code: PERMISSIONS.menuWrite, label: '修改菜单配置', group: '菜单管理', requires: [PERMISSIONS.menuRead] },
]

export interface SessionUser {
  id: string
  username: string
  displayName: string
  avatarUrl?: string
  email?: string
  phone?: string
  title?: string
  department?: string
  bio?: string
  roles: string[]
  permissions: string[]
  navigation?: MenuSetting[]
}

export function hasPermissions(user: SessionUser | null, required: PermissionRequirement = []) {
  if (!user) return false
  const permissions = new Set(user.permissions)
  return (typeof required === 'string' ? [required] : required).every(item => permissions.has(item))
}

// 会话响应异常时拒绝使用，避免把错误响应当作已登录用户。
export function parseSessionUser(value: unknown): SessionUser {
  if (!value || typeof value !== 'object') throw new Error('无效的会话响应')
  const user = value as Record<string, unknown>
  if (![user.id, user.username, user.displayName].every(item => typeof item === 'string' && item.length > 0)
    || !Array.isArray(user.roles) || !user.roles.every(item => typeof item === 'string')
    || !Array.isArray(user.permissions) || !user.permissions.every(item => typeof item === 'string')) {
    throw new Error('无效的会话响应')
  }
  for (const key of ['avatarUrl', 'email', 'phone', 'title', 'department', 'bio']) {
    if (user[key] !== undefined && typeof user[key] !== 'string') throw new Error('无效的会话响应')
  }
  if (user.navigation !== undefined && (!Array.isArray(user.navigation) || !user.navigation.every(item =>
    item && typeof item === 'object' && typeof item.routeName === 'string' && typeof item.title === 'string'
    && typeof item.icon === 'string' && typeof item.visible === 'boolean' && Number.isInteger(item.order)
    && Array.isArray(item.permissions) && item.permissions.every((code: unknown) => typeof code === 'string')))) {
    throw new Error('无效的菜单配置')
  }
  return value as SessionUser
}
