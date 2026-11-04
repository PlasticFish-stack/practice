import { PERMISSIONS as P } from './permissions.ts'
import type { MenuSetting } from '../types/system.ts'

export const MENU_ICONS = ['Monitor', 'FolderOpened', 'Connection', 'User', 'UserFilled', 'Setting', 'Key', 'Menu', 'Document', 'Tools'] as const

// 只允许管理已注册页面的菜单配置，URL 和组件由应用代码确定。
export const DEFAULT_NAVIGATION: readonly MenuSetting[] = [
  { routeName: 'devices', path: '/device', title: '设备列表', icon: 'Monitor', order: 10, permissions: [P.deviceRead] },
  { routeName: 'playground', path: '/playground', title: '开发演示', icon: 'FolderOpened', order: 20, permissions: [P.playgroundRead] },
  { routeName: 'websocket-demo', parent: 'playground', path: '/playground/websocket', title: 'WebSocket 演示', icon: 'Connection', order: 10, permissions: [P.playgroundRead] },
  { routeName: 'system', path: '/system', title: '系统管理', icon: 'Setting', order: 40, permissions: [], protected: true },
  { routeName: 'system-users', parent: 'system', path: '/system/users', title: '用户管理', icon: 'User', order: 10, permissions: [P.userRead] },
  { routeName: 'system-roles', parent: 'system', path: '/system/roles', title: '角色管理', icon: 'Key', order: 20, permissions: [P.roleRead] },
  { routeName: 'system-menus', parent: 'system', path: '/system/menus', title: '菜单管理', icon: 'Menu', order: 30, permissions: [P.menuRead], protected: true },
  { routeName: 'account-center', parent: 'system', path: '/account/center', title: '个人中心', icon: 'UserFilled', order: 40, permissions: [], protected: true },
].map(item => ({ visible: true, version: 1, protected: false, ...item })) as MenuSetting[]
