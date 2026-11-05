import type { RouteRecordRaw } from 'vue-router';
import { PERMISSIONS } from '@/auth/permissions';

export const routes: RouteRecordRaw[] = [
  {
    path: '/session-error',
    name: 'session-error',
    component: () => import('@/views/errors/SessionError.vue'),
    meta: { title: '会话服务暂不可用', public: true },
  },
  {
    path: '/',
    name: 'layout',
    component: () => import('@/layouts/DefaultLayout.vue'),
    meta: { title: '首页' },
    children: [
      {
        path: 'observe',
        name: 'observe',
        component: () => import('@/views/observe/ObservePage.vue'),
        meta: {
          title: 'Xray 观察面板',
          authentication: 'observer',
          menu: true,
          menuOrder: 100,
          icon: 'DataAnalysis',
          keepAlive: false,
        },
      },
      {
        path: 'account',
        name: 'account',
        redirect: { name: 'account-center' },
        meta: { title: '账户', menu: false },
        children: [
          {
            path: 'settings',
            name: 'account-settings',
            redirect: (to) => ({
              name: 'account-center',
              query: { ...to.query, edit: '1' },
              hash: to.hash,
            }),
          },
        ],
      },
      {
        path: 'system',
        name: 'system',
        meta: { title: '系统管理', menu: true, menuOrder: 20, icon: 'Setting' },
        children: [
          {
            path: 'users',
            name: 'system-users',
            component: () => import('@/views/system/UsersPage.vue'),
            meta: {
              title: '用户管理',
              menu: true,
              menuOrder: 10,
              icon: 'User',
              permissions: [PERMISSIONS.userRead],
            },
          },
          {
            path: 'roles',
            name: 'system-roles',
            component: () => import('@/views/system/RolesPage.vue'),
            meta: {
              title: '角色管理',
              menu: true,
              menuOrder: 20,
              icon: 'Key',
              permissions: [PERMISSIONS.roleRead],
            },
          },
          {
            path: 'menus',
            name: 'system-menus',
            component: () => import('@/views/system/MenusPage.vue'),
            meta: {
              title: '菜单管理',
              menu: true,
              menuOrder: 30,
              icon: 'Menu',
              permissions: [PERMISSIONS.menuRead],
            },
          },
          {
            path: '/account/center',
            name: 'account-center',
            component: () => import('@/views/account/AccountCenter.vue'),
            meta: {
              title: '个人中心',
              menu: true,
              menuOrder: 40,
              icon: 'UserFilled',
              searchable: true,
            },
          },
        ],
      },
      {
        path: '403',
        name: 'forbidden',
        component: () => import('@/views/errors/Forbidden.vue'),
        meta: { title: '没有访问权限', tab: false, keepAlive: false },
      },
      {
        path: 'device',
        name: 'devices',
        component: () => import('@/views/devices/DeviceList.vue'),
        meta: {
          title: '设备列表',
          menu: true,
          menuOrder: 10,
          icon: 'Monitor',
          permissions: [PERMISSIONS.deviceRead],
        },
      },
      {
        path: 'playground',
        name: 'playground',
        redirect: { name: 'charts-demo' },
        meta: {
          title: '开发演示',
          menu: true,
          menuOrder: 90,
          icon: 'FolderOpened',
          permissions: [PERMISSIONS.playgroundRead],
        },
        children: [
          {
            path: 'websocket',
            name: 'websocket-demo',
            component: () => import('@/views/playground/WebSocketDemo.vue'),
            meta: {
              title: 'WebSocket 演示',
              menu: true,
              menuOrder: 20,
              icon: 'Connection',
              permissions: [PERMISSIONS.playgroundRead],
            },
          },
          {
            path: 'charts',
            name: 'charts-demo',
            component: () => import('@/views/playground/ChartsDemo.vue'),
            meta: {
              title: '图表演示',
              menu: true,
              menuOrder: 10,
              icon: 'DataAnalysis',
              permissions: [PERMISSIONS.playgroundRead],
            },
          },
          {
            path: 'terminal',
            name: 'terminal-demo',
            component: () => import('@/views/playground/TerminalDemo.vue'),
            meta: {
              title: '终端演示',
              menu: true,
              menuOrder: 30,
              icon: 'Monitor',
              permissions: [PERMISSIONS.playgroundRead],
            },
          },
        ],
      },
      {
        path: ':pathMatch(.*)*',
        name: 'not-found',
        component: () => import('@/views/errors/NotFound.vue'),
        meta: { title: '页面不存在', tab: false, keepAlive: false },
      },
    ],
  },
  {
    path: '/login',
    name: 'login',
    component: () => import('@/views/login/LoginPage.vue'),
    meta: { title: '登录', public: true },
  },
];
