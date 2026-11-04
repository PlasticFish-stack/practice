import 'vue-router'
import type { Permission } from '@/auth/permissions'

declare module 'vue-router' {
  interface RouteMeta {
    public?: boolean
    permissions?: readonly Permission[]
    title?: string
    searchable?: boolean
    menu?: boolean
    menuOrder?: number
    /** 已在 main.ts 注册的 Element Plus 图标名称。 */
    icon?: string
  }
}
