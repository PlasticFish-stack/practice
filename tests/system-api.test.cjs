const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mockServer } = require('./helpers/mock-server.cjs');

const base = '/api/system/';
const roleDraft = (code, permissions) => ({
  code,
  name: code,
  description: '测试角色',
  enabled: true,
  permissions,
});
const userDraft = (username, roleIds) => ({
  username,
  displayName: username,
  email: '',
  enabled: true,
  roleIds,
  password: 'Password12345',
});
const editUser = (row, changes = {}) => {
  const { id, ...draft } = row;
  return { ...draft, password: '', ...changes };
};
const editRole = (row, changes = {}) => {
  const { id, protected: _, ...draft } = row;
  return { ...draft, ...changes };
};
const editMenu = (row, changes = {}) => ({
  title: row.title,
  icon: row.icon,
  order: row.order,
  visible: row.visible,
  permissions: row.permissions,
  version: row.version,
  ...changes,
});

test('RBAC administration enforces authorization, concurrency, live revocation and administrator protection', async () => {
  const server = await mockServer();
  try {
    const admin = server.client(),
      viewer = server.client();
    assert.equal((await admin.request(base + 'users')).status, 401);
    assert.equal((await admin.login('admin')).status, 200);
    await viewer.login('viewer');
    for (const resource of ['users', 'roles', 'menus', 'catalog', 'audit'])
      assert.equal((await viewer.request(base + resource)).status, 403);
    assert.equal(
      (await viewer.request(base + 'roles', 'POST', roleDraft('illegal', []))).status,
      403,
    );
    const users = (await admin.request(base + 'users?page=1&pageSize=2')).data;
    assert.equal(users.list.length, 2);
    assert.equal(users.total, 3);
    assert.equal(JSON.stringify(users).includes('passwordHash'), false);
    assert.equal((await admin.request(base + 'users?pageSize=101')).status, 400);

    const role = await admin.request(
      base + 'roles',
      'POST',
      roleDraft('device_editor', ['devices:read', 'devices:update']),
    );
    assert.equal(role.status, 200);
    const created = await admin.request(
      base + 'users',
      'POST',
      userDraft('new_operator', [role.data.id]),
    );
    assert.equal(created.status, 200);
    assert.equal(
      (await admin.request(base + 'users', 'POST', userDraft('NEW_OPERATOR', []))).status,
      409,
    );
    assert.equal(
      (
        await admin.request(base + 'users', 'POST', {
          ...userDraft('invalid_user', []),
          permissions: ['devices:update'],
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await admin.request(base + 'roles/' + role.data.id, 'DELETE', {
          version: role.data.version,
        })
      ).status,
      409,
    );
    const member = server.client();
    assert.equal((await member.login('new_operator', 'Password12345')).status, 200);
    assert.equal((await member.request('/api/devices')).status, 200);
    const device = (await member.request('/api/devices')).data.list[0];

    const reduced = await admin.request(
      base + 'roles/' + role.data.id,
      'PATCH',
      editRole(role.data, { permissions: ['devices:read'] }),
    );
    assert.equal(reduced.status, 200);
    assert.deepEqual((await member.request('/api/auth/session')).data.permissions, [
      'devices:read',
    ]);
    assert.equal(
      (
        await member.request('/api/devices/' + device.id, 'PATCH', {
          name: '不可修改',
          version: device.version,
        })
      ).status,
      403,
    );
    assert.equal(
      (await admin.request(base + 'roles/' + role.data.id, 'PATCH', editRole(role.data))).status,
      409,
    );
    const disabledRole = await admin.request(
      base + 'roles/' + role.data.id,
      'PATCH',
      editRole(reduced.data, { enabled: false }),
    );
    assert.equal(disabledRole.status, 200);
    assert.equal((await member.request('/api/devices')).status, 403);
    assert.equal(
      (
        await admin.request(
          base + 'users/' + created.data.id,
          'PATCH',
          editUser(created.data, { roleIds: [], enabled: false }),
        )
      ).status,
      200,
    );
    assert.equal((await member.request('/api/auth/session')).status, 401);
    assert.equal((await member.login('new_operator', 'Password12345')).status, 401);

    const allUsers = (await admin.request(base + 'users')).data.list;
    const currentAdmin = allUsers.find((user) => user.id === 'admin');
    assert.equal(
      (
        await admin.request(
          base + 'users/admin',
          'PATCH',
          editUser(currentAdmin, { enabled: false }),
        )
      ).status,
      409,
    );
    assert.equal(
      (await admin.request(base + 'users/admin', 'PATCH', editUser(currentAdmin, { roleIds: [] })))
        .status,
      409,
    );
    const adminRole = (await admin.request(base + 'roles')).data.list.find(
      (item) => item.id === 'admin',
    );
    assert.equal(
      (await admin.request(base + 'roles/admin', 'PATCH', editRole(adminRole, { permissions: [] })))
        .status,
      409,
    );
    assert.equal(
      (await admin.request(base + 'roles/admin', 'DELETE', { version: adminRole.version })).status,
      409,
    );

    const viewerRecord = allUsers.find((user) => user.id === 'viewer');
    assert.equal(
      (
        await admin.request(
          base + 'users/viewer',
          'PATCH',
          editUser(viewerRecord, { password: 'NewPassword1234' }),
        )
      ).status,
      200,
    );
    assert.equal((await viewer.request('/api/auth/session')).status, 401);
    assert.equal((await viewer.login('viewer', 'NewPassword1234')).status, 200);
    assert.ok(
      (await admin.request(base + 'audit')).data.some((item) => item.action === 'role.update'),
    );
  } finally {
    await server.close();
  }
});

test('delegated managers cannot escalate privileges; menu registry preserves page boundaries', async () => {
  const server = await mockServer();
  try {
    const admin = server.client();
    await admin.login('admin');
    const managedPermissions = [
      'system:users:read',
      'system:users:write',
      'system:roles:read',
      'system:roles:write',
      'system:menus:read',
      'system:menus:write',
    ];
    const delegatedRole = (
      await admin.request(base + 'roles', 'POST', roleDraft('delegated', managedPermissions))
    ).data;
    await admin.request(base + 'users', 'POST', userDraft('delegated_user', [delegatedRole.id]));
    const delegated = server.client();
    await delegated.login('delegated_user', 'Password12345');
    assert.equal(
      (await delegated.request(base + 'roles', 'POST', roleDraft('escalated', ['devices:read'])))
        .status,
      403,
    );
    assert.equal(
      (await delegated.request(base + 'users', 'POST', userDraft('escalated_user', ['admin'])))
        .status,
      403,
    );
    const adminUser = (await delegated.request(base + 'users')).data.list.find(
      (item) => item.id === 'admin',
    );
    assert.equal(
      (
        await delegated.request(
          base + 'users/admin',
          'PATCH',
          editUser(adminUser, { password: 'HijackPassword1234' }),
        )
      ).status,
      403,
    );
    assert.equal(
      (
        await admin.request(
          base + 'roles',
          'POST',
          roleDraft('invalid_dependency', ['devices:update']),
        )
      ).status,
      400,
    );

    const menus = (await admin.request(base + 'menus')).data;
    const devices = menus.find((item) => item.routeName === 'devices');
    assert.equal(
      (await admin.request(base + 'menus/devices', 'PATCH', editMenu(devices, { permissions: [] })))
        .status,
      400,
    );
    assert.equal(
      (
        await admin.request(base + 'menus/devices', 'PATCH', {
          ...editMenu(devices),
          component: 'https://evil.test/code.js',
        })
      ).status,
      400,
    );
    const hidden = await admin.request(
      base + 'menus/devices',
      'PATCH',
      editMenu(devices, { title: '设备总览', visible: false }),
    );
    assert.equal(hidden.status, 200);
    assert.equal(
      (await admin.request(base + 'menus/devices', 'PATCH', editMenu(devices))).status,
      409,
    );
    assert.equal(
      (await admin.request(base + 'menus/non-existent', 'PATCH', editMenu(devices))).status,
      404,
    );
    const session = (await admin.request('/api/auth/session')).data;
    assert.equal(session.navigation.find((item) => item.routeName === 'devices').visible, false);
    assert.equal((await admin.request('/api/devices')).status, 200);
    for (const name of ['system', 'system-menus', 'account-center']) {
      const menu = menus.find((item) => item.routeName === name);
      assert.equal(
        (await admin.request(base + 'menus/' + name, 'PATCH', editMenu(menu, { visible: false })))
          .status,
        409,
      );
    }
    const log = JSON.stringify((await admin.request(base + 'audit')).data);
    assert.equal(log.includes('Password12345'), false);
  } finally {
    await server.close();
  }
});
