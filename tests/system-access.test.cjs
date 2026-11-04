const { test } = require('node:test')
const assert = require('node:assert/strict')
const { createRouter, createMemoryHistory } = require('vue-router')
const { createLoader } = require('./helpers/load-ts.cjs')

test('menu settings change presentation while page permissions remain enforced on direct URLs', () => {
  const load = createLoader()
  const router = createRouter({ history: createMemoryHistory(), routes: load('src/router/routes.ts').routes })
  const { accessibleMenus, canAccessRoute } = load('src/router/access.ts')
  const { parseSessionUser } = load('src/auth/permissions.ts')
  const setting = { routeName: 'devices', title: '设备总览', path: '/device', icon: 'Monitor', visible: true, order: 80, permissions: ['devices:read'], version: 1, protected: false }
  const user = parseSessionUser({ id: 'user', username: 'user', displayName: 'user', roles: ['admin'], permissions: ['devices:read'], navigation: [setting] })
  const auth = { user, can: required => (typeof required === 'string' ? [required] : required).every(code => user.permissions.includes(code)) }
  assert.equal(accessibleMenus(router, auth).find(item => item.index === 'devices').title, '设备总览')
  assert.equal(accessibleMenus(router, auth).at(-1).index, 'devices')
  setting.visible = false
  assert.equal(accessibleMenus(router, auth).some(item => item.index === 'devices'), false)
  assert.equal(canAccessRoute(router.resolve('/device'), auth), true)
  setting.permissions.push('playground:read')
  assert.equal(canAccessRoute(router.resolve('/device'), auth), false)
  assert.throws(() => parseSessionUser({ ...user, navigation: [{ ...setting, permissions: 'devices:read' }] }), /无效的菜单配置/)
})
