import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';
import { Buffer } from 'node:buffer';
import { DEFAULT_NAVIGATION, MENU_ICONS } from '../src/auth/navigation.ts';
import { PERMISSIONS, PERMISSION_CATALOG } from '../src/auth/permissions.ts';
import type { SessionUser, Permission } from '../src/auth/permissions.ts';
import type { RoleRecord, UserRecord, MenuSetting } from '../src/types/system.ts';

export class SystemError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
const fail = (status: number, message: string): never => {
  throw new SystemError(status, message);
};
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));
const hash = (password: string, salt: string) => scryptSync(password, salt, 32).toString('hex');

export function createSystem() {
  const roles: RoleRecord[] = [
    {
      id: 'admin',
      code: 'admin',
      name: '系统管理员',
      description: '内置管理员，拥有全部权限',
      enabled: true,
      permissions: Object.values(PERMISSIONS),
      protected: true,
      version: 1,
    },
    {
      id: 'viewer',
      code: 'viewer',
      name: '基础访客',
      description: '仅可访问个人中心',
      enabled: true,
      permissions: [],
      protected: false,
      version: 1,
    },
    {
      id: 'tester',
      code: 'tester',
      name: '普通用户',
      description: '仅可访问个人中心',
      enabled: true,
      permissions: [],
      protected: false,
      version: 1,
    },
  ];
  type StoredUser = UserRecord & {
    salt: string;
    passwordHash: string;
    profile: Partial<SessionUser>;
  };
  const users: StoredUser[] = [
    ['admin', '管理员', 'admin'],
    ['viewer', '只读用户', 'viewer'],
    ['tester', '普通用户', 'tester'],
  ].map(([id, displayName, role]) => {
    const salt = randomBytes(16).toString('hex');
    return {
      id: id!,
      username: id!,
      displayName: displayName!,
      email: `${id}@example.test`,
      roleIds: [role!],
      enabled: true,
      version: 1,
      salt,
      passwordHash: hash('Demo@123456', salt),
      profile: {
        avatarUrl: '',
        phone: '',
        title: roles.find((item) => item.id === role)!.name,
        department: id === 'admin' ? '系统管理' : '日常办公',
        bio: '',
      },
    };
  });
  const menus = clone(DEFAULT_NAVIGATION) as MenuSetting[];
  const audit: { at: string; actor: string; action: string; target: string }[] = [];
  function log(actor: string, action: string, target: string) {
    audit.unshift({ at: new Date().toISOString(), actor, action, target });
    audit.splice(200);
  }
  const publicUser = ({
    salt: _,
    passwordHash: __,
    profile: ___,
    ...user
  }: StoredUser): UserRecord => clone(user);
  function session(id: string): SessionUser | undefined {
    const user = users.find((item) => item.id === id && item.enabled);
    if (!user) return;
    const assigned = roles.filter((role) => role.enabled && user.roleIds.includes(role.id));
    return {
      ...user.profile,
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      email: user.email,
      roles: assigned.map((role) => role.code),
      permissions: [...new Set(assigned.flatMap((role) => role.permissions))],
      navigation: clone(menus),
    };
  }
  function authenticate(username: unknown, password: unknown) {
    const user = users.find((item) => item.username === username && item.enabled);
    if (!user || typeof password !== 'string' || password.length > 256) return;
    return timingSafeEqual(
      Buffer.from(hash(password, user.salt), 'hex'),
      Buffer.from(user.passwordHash, 'hex'),
    )
      ? session(user.id)
      : undefined;
  }
  function allowed(data: Record<string, unknown>, fields: string[]) {
    if (Object.keys(data).some((key) => !fields.includes(key))) fail(400, '包含不允许修改的字段');
  }
  function text(value: unknown, label: string, max: number, required = true): string {
    if (typeof value !== 'string' || value.trim().length > max || (required && !value.trim()))
      return fail(400, `${label}格式不正确`);
    return value.trim();
  }
  function bool(value: unknown): boolean {
    if (typeof value !== 'boolean') return fail(400, '状态必须为布尔值');
    return value;
  }
  function strings(value: unknown): string[] {
    if (
      !Array.isArray(value) ||
      value.length > 100 ||
      value.some((item) => typeof item !== 'string') ||
      new Set(value).size !== value.length
    )
      return fail(400, '选项列表格式不正确');
    return value;
  }
  function version(data: Record<string, unknown>, current: { version: number }) {
    if (data.version !== current.version) fail(409, '数据已被修改，请刷新后重新编辑');
  }
  function grant(actor: SessionUser, permissions: readonly string[]) {
    if (permissions.some((code) => !actor.permissions.includes(code)))
      fail(403, '不能授予自己未拥有的权限');
  }
  function permissionList(value: unknown, actor: SessionUser): Permission[] {
    const values = strings(value);
    if (values.some((code) => !PERMISSION_CATALOG.some((item) => item.code === code)))
      fail(400, '存在未注册的权限');
    grant(actor, values);
    for (const code of values) {
      if (
        PERMISSION_CATALOG.find((item) => item.code === code)?.requires?.some(
          (required) => !values.includes(required),
        )
      )
        fail(400, '操作权限必须包含对应的查看权限');
    }
    return values as Permission[];
  }
  function preserveAdministrator(nextUsers: StoredUser[]) {
    if (!nextUsers.some((user) => user.enabled && user.roleIds.includes('admin')))
      fail(409, '必须保留至少一个启用的系统管理员');
  }
  function saveUser(actor: SessionUser, id: string | undefined, data: Record<string, unknown>) {
    allowed(data, [
      'username',
      'displayName',
      'email',
      'roleIds',
      'enabled',
      'password',
      'version',
    ]);
    const current = id ? users.find((item) => item.id === id) : undefined;
    if (id && !current) return fail(404, '用户不存在');
    if (current) version(data, current);
    // 无法借助修改高权限用户或给其重置密码取得额外权限。
    if (current)
      grant(
        actor,
        session(current.id)?.permissions ??
          roles
            .filter((role) => current.roleIds.includes(role.id))
            .flatMap((role) => role.permissions),
      );
    const username = text(data.username, '用户名', 40);
    if (!/^[A-Za-z][A-Za-z0-9_-]{2,39}$/.test(username))
      fail(400, '用户名需为 3–40 位字母、数字、下划线或短横线，并以字母开头');
    if (current && current.username !== username) fail(400, '用户名不可修改');
    if (
      users.some((user) => user.id !== id && user.username.toLowerCase() === username.toLowerCase())
    )
      fail(409, '用户名已存在');
    const email = text(data.email, '邮箱', 254, false);
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail(400, '邮箱格式不正确');
    const roleIds = strings(data.roleIds);
    if (roleIds.some((roleId) => !roles.some((role) => role.id === roleId && role.enabled)))
      fail(400, '请选择有效且启用的角色');
    grant(
      actor,
      roles.filter((role) => roleIds.includes(role.id)).flatMap((role) => role.permissions),
    );
    const enabled = bool(data.enabled);
    if (id === actor.id && !enabled) fail(409, '不能停用当前登录账号');
    const password = data.password;
    if (typeof password !== 'string') return fail(400, '密码格式不正确');
    if (
      (!current || password) &&
      (password.length < 12 ||
        password.length > 128 ||
        !/[A-Za-z]/.test(password) ||
        !/[0-9]/.test(password))
    )
      fail(400, '密码需为 12–128 位，并包含字母和数字');
    const salt = password ? randomBytes(16).toString('hex') : current!.salt;
    const next: StoredUser = {
      id: id ?? randomUUID(),
      username,
      displayName: text(data.displayName, '显示名称', 40),
      email,
      roleIds,
      enabled,
      version: (current?.version ?? 0) + 1,
      profile: current?.profile ?? { avatarUrl: '', phone: '', title: '', department: '', bio: '' },
      salt,
      passwordHash: password ? hash(password, salt) : current!.passwordHash,
    };
    preserveAdministrator([...users.filter((user) => user.id !== id), next]);
    if (current) Object.assign(current, next);
    else users.push(next);
    log(actor.id, current ? 'user.update' : 'user.create', next.id);
    return publicUser(next);
  }
  function deleteUser(actor: SessionUser, id: string, data: Record<string, unknown>) {
    allowed(data, ['version']);
    const user = users.find((item) => item.id === id);
    if (!user) return fail(404, '用户不存在');
    version(data, user);
    if (id === actor.id) fail(409, '不能删除当前登录账号');
    grant(
      actor,
      roles.filter((role) => user.roleIds.includes(role.id)).flatMap((role) => role.permissions),
    );
    preserveAdministrator(users.filter((item) => item.id !== id));
    users.splice(users.indexOf(user), 1);
    log(actor.id, 'user.delete', id);
  }
  function saveRole(actor: SessionUser, id: string | undefined, data: Record<string, unknown>) {
    allowed(data, ['code', 'name', 'description', 'enabled', 'permissions', 'version']);
    const current = id ? roles.find((item) => item.id === id) : undefined;
    if (id && !current) return fail(404, '角色不存在');
    if (current) {
      version(data, current);
      if (current.protected) fail(409, '内置管理员角色不可修改');
      grant(actor, current.permissions);
    }
    const code = text(data.code, '角色编码', 40);
    if (!/^[a-z][a-z0-9_-]{1,39}$/.test(code))
      fail(400, '角色编码需为 2–40 位小写字母、数字、下划线或短横线');
    if (current && current.code !== code) fail(400, '角色编码不可修改');
    if (roles.some((role) => role.id !== id && role.code === code)) fail(409, '角色编码已存在');
    const next: RoleRecord = {
      id: id ?? randomUUID(),
      code,
      name: text(data.name, '角色名称', 50),
      description: text(data.description, '角色描述', 200, false),
      enabled: bool(data.enabled),
      permissions: permissionList(data.permissions, actor),
      protected: false,
      version: (current?.version ?? 0) + 1,
    };
    if (current) Object.assign(current, next);
    else roles.push(next);
    log(actor.id, current ? 'role.update' : 'role.create', next.id);
    return clone(next);
  }
  function deleteRole(actor: SessionUser, id: string, data: Record<string, unknown>) {
    allowed(data, ['version']);
    const role = roles.find((item) => item.id === id);
    if (!role) return fail(404, '角色不存在');
    version(data, role);
    if (role.protected) fail(409, '内置管理员角色不可删除');
    grant(actor, role.permissions);
    if (users.some((user) => user.roleIds.includes(id)))
      fail(409, '角色已分配给用户，请先解除分配');
    roles.splice(roles.indexOf(role), 1);
    log(actor.id, 'role.delete', id);
  }
  function saveMenu(actor: SessionUser, name: string, data: Record<string, unknown>) {
    allowed(data, ['title', 'icon', 'order', 'visible', 'permissions', 'version']);
    const menu = menus.find((item) => item.routeName === name);
    if (!menu) return fail(404, '菜单不存在');
    version(data, menu);
    const permissions = permissionList(data.permissions, actor);
    const baseline = DEFAULT_NAVIGATION.find((item) => item.routeName === name)!;
    if (baseline.permissions.some((code) => !permissions.includes(code)))
      fail(400, '不能移除页面必需的权限');
    const visible = bool(data.visible);
    if (menu.protected && (!visible || permissions.length !== baseline.permissions.length))
      fail(409, '此入口的可见性和访问权限受保护');
    if (
      !MENU_ICONS.includes(data.icon as (typeof MENU_ICONS)[number]) ||
      !Number.isInteger(data.order) ||
      Number(data.order) < 0 ||
      Number(data.order) > 9999
    )
      fail(400, '图标或排序不正确');
    Object.assign(menu, {
      title: text(data.title, '菜单名称', 40),
      icon: data.icon,
      order: data.order,
      visible,
      permissions,
      version: menu.version + 1,
    });
    log(actor.id, 'menu.update', name);
    return clone(menu);
  }
  return {
    session,
    authenticate,
    saveUser,
    deleteUser,
    saveRole,
    deleteRole,
    saveMenu,
    users: () => users.map(publicUser),
    roles: () => clone(roles),
    menus: () => clone(menus),
    audit: () => clone(audit),
    catalog: () => ({
      roles: clone(roles),
      permissions: clone(PERMISSION_CATALOG),
      icons: [...new Set(MENU_ICONS)],
    }),
    updateProfile(id: string, changes: Record<string, unknown>) {
      const user = users.find((item) => item.id === id)!;
      user.displayName = String(changes.displayName).trim();
      user.email = String(changes.email ?? '');
      Object.assign(user.profile, changes);
      user.version++;
      return session(id)!;
    },
  };
}
