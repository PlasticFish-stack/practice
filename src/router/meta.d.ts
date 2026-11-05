import 'vue-router';
import type { Permission } from '@/auth/permissions';

declare module 'vue-router' {
  interface RouteMeta {
    public?: boolean;
    /** 观察页在工作区内使用独立 Bearer 鉴权，不复用后台 Cookie 会话。 */
    authentication?: 'observer';
    permissions?: readonly Permission[];
    title?: string;
    searchable?: boolean;
    menu?: boolean;
    menuOrder?: number;
    /** 不创建页签，例如错误页。 */
    tab?: boolean;
    /** 页面默认缓存；设为 false 时切换后重新创建。 */
    keepAlive?: boolean;
    /** 已在 main.ts 注册的 Element Plus 图标名称。 */
    icon?: string;
  }
}
