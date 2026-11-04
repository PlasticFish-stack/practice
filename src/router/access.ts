import type { Router, RouteLocationNormalized } from 'vue-router'
import type { useAuthStore } from '@/stores/auth'
import { buildMenuTree, firstMenuPath } from './menu'

type Auth = ReturnType<typeof useAuthStore>
type AccessAuth = Pick<Auth, 'can'> & Partial<Pick<Auth, 'user'>>

export function canAccessRoute(route: Pick<RouteLocationNormalized, 'matched'>, auth: AccessAuth) {
  // 检查每一层，子路由不能覆盖父路由的权限要求。
  return route.matched.every(record => auth.can(record.meta.permissions ?? [])
    && auth.can(auth.user?.navigation?.find(item => item.routeName === record.name)?.permissions ?? []))
}

export function accessibleMenus(router: Router, auth: AccessAuth) {
  return buildMenuTree(router, required => auth.can(required), auth.user?.navigation)
}

export function defaultDestination(router: Router, auth: AccessAuth) {
  return firstMenuPath(accessibleMenus(router, auth)) ?? '/403'
}

export function safeDestination(value: unknown, router: Router, auth: AccessAuth) {
  // eslint-disable-next-line no-control-regex -- Intentionally reject control characters in redirect URLs.
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || /[\\\u0000-\u0020]/.test(value)) {
    return defaultDestination(router, auth)
  }
  const target = router.resolve(value)
  if (['login', 'session-error', 'not-found', 'layout'].includes(String(target.name))
    || target.meta.public || !canAccessRoute(target, auth)) return defaultDestination(router, auth)
  return target.fullPath
}

export function installAuthGuard(router: Router, auth: Auth) {
  router.beforeEach(async to => {
    if (to.meta.public && to.name !== 'login') return true
    try {
      // 每次导航向服务端确认会话；并发导航由 Store 合并请求。
      await auth.ensureSession(true)
    } catch {
      if (to.name === 'login') return true
      return { name: 'session-error', query: { redirect: to.fullPath }, replace: true }
    }
    if (!auth.authenticated) {
      if (to.meta.public) return true
      return { name: 'login', query: { redirect: to.fullPath }, replace: true }
    }
    if (to.name === 'layout') return { path: defaultDestination(router, auth), replace: true }
    if (to.name === 'system') {
      const group = accessibleMenus(router, auth).find(item => item.index === 'system')
      return group ? { path: firstMenuPath(group.children)!, replace: true } : { name: 'forbidden', replace: true }
    }
    if (to.name === 'login') return { path: safeDestination(to.query.redirect, router, auth), replace: true }
    if (!canAccessRoute(to, auth)) return { name: 'forbidden', replace: true }
    return true
  })
}
