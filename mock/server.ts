import { randomBytes } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin } from 'vite';
import { validateProfile } from '../src/auth/profile.ts';
import { PERMISSIONS } from '../src/auth/permissions.ts';
import { createSystem, SystemError } from './system.ts';

// 仅由 Vite mock 模式加载，不进入浏览器或生产服务。
export function createMockApi() {
  const system = createSystem();
  const sessions = new Map<string, { userId: string; expires: number }>();
  const csrfTokens = new Map<string, number>();
  const loginAttempts = new Map<string, { count: number; expires: number }>();
  const ttl = 8 * 60 * 60 * 1000;
  const issue = () => randomBytes(32).toString('hex');
  const cookie = (name: string, value: string, httpOnly = false, maxAge = ttl / 1000) =>
    `${name}=${value}; Path=/; SameSite=Lax; Max-Age=${maxAge}${httpOnly ? '; HttpOnly' : ''}`;

  function send(res: ServerResponse, status: number, data: unknown = null, message = 'ok') {
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.end(JSON.stringify({ code: status, message, data }));
  }
  async function body(req: IncomingMessage): Promise<Record<string, unknown>> {
    let text = '';
    for await (const chunk of req) {
      text += chunk;
      if (text.length > 16384) throw new Error('请求体过大');
    }
    const value: unknown = JSON.parse(text || '{}');
    if (!value || typeof value !== 'object' || Array.isArray(value))
      throw new Error('请求体格式错误');
    return value as Record<string, unknown>;
  }

  return async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (!url.pathname.startsWith('/api/')) return next();
    const now = Date.now();
    for (const [id, item] of sessions) if (item.expires <= now) sessions.delete(id);
    for (const [id, expires] of csrfTokens) if (expires <= now) csrfTokens.delete(id);
    for (const [id, item] of loginAttempts) if (item.expires <= now) loginAttempts.delete(id);
    const cookies = Object.fromEntries(
      (req.headers.cookie ?? '').split(';').map((item) => {
        const index = item.indexOf('=');
        return [item.slice(0, index).trim(), item.slice(index + 1)];
      }),
    );
    const session = sessions.get(cookies['mock-session'] ?? '');
    const user = session ? system.session(session.userId) : undefined;
    const method = req.method ?? 'GET';

    if (url.pathname === '/api/auth/csrf' && method === 'GET') {
      const token = issue();
      csrfTokens.set(token, now + ttl);
      res.setHeader('Set-Cookie', cookie('XSRF-TOKEN', token));
      return send(res, 200);
    }
    if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
      const csrf = cookies['XSRF-TOKEN'] ?? '';
      const origin = req.headers.origin;
      if (
        !csrf ||
        !csrfTokens.has(csrf) ||
        csrf !== req.headers['x-xsrf-token'] ||
        (origin && new URL(origin).host !== req.headers.host)
      ) {
        return send(res, 403, null, 'CSRF 校验失败，请刷新后重试');
      }
    }
    if (url.pathname === '/api/auth/login' && method === 'POST') {
      const ip = req.socket.remoteAddress ?? 'local';
      const attempts = loginAttempts.get(ip) ?? { count: 0, expires: now + 60000 };
      attempts.count++;
      loginAttempts.set(ip, attempts);
      if (attempts.count > 20) return send(res, 429, null, '登录尝试过于频繁，请稍后重试');
      let credentials;
      try {
        credentials = await body(req);
      } catch {
        return send(res, 400, null, '请求体格式错误');
      }
      const profile = system.authenticate(credentials.username, credentials.password);
      if (!profile) return send(res, 401, null, '用户名或密码错误');
      loginAttempts.delete(ip);
      sessions.delete(cookies['mock-session'] ?? '');
      const id = issue();
      sessions.set(id, { userId: profile.id, expires: now + ttl });
      res.setHeader('Set-Cookie', cookie('mock-session', id, true));
      return send(res, 200, profile);
    }
    if (!user) return send(res, 401, null, '登录已过期，请重新登录');
    if (url.pathname === '/api/auth/session' && method === 'GET') return send(res, 200, user);
    if (url.pathname === '/api/auth/profile' && method === 'PATCH') {
      let changes;
      try {
        changes = await body(req);
      } catch {
        return send(res, 400, null, '请求体格式错误');
      }
      const error = validateProfile(changes);
      if (error) return send(res, 400, null, error);
      if (!system.session(user.id)) return send(res, 401, null, '登录已过期，请重新登录');
      return send(res, 200, system.updateProfile(user.id, changes));
    }
    if (url.pathname === '/api/auth/logout' && method === 'POST') {
      sessions.delete(cookies['mock-session'] ?? '');
      res.setHeader('Set-Cookie', cookie('mock-session', '', true, 0));
      return send(res, 200);
    }
    if (url.pathname.startsWith('/api/system/')) {
      const match = /^\/api\/system\/(users|roles|menus|catalog|audit)(?:\/([^/]+))?$/.exec(
        url.pathname,
      );
      if (!match) return send(res, 404, null, '接口不存在');
      const resource = match[1]!,
        id = match[2];
      const readPermission =
        resource === 'users'
          ? PERMISSIONS.userRead
          : resource === 'roles'
            ? PERMISSIONS.roleRead
            : PERMISSIONS.menuRead;
      const writePermission =
        resource === 'users'
          ? PERMISSIONS.userWrite
          : resource === 'roles'
            ? PERMISSIONS.roleWrite
            : PERMISSIONS.menuWrite;
      const catalogAccess = [PERMISSIONS.userRead, PERMISSIONS.roleRead, PERMISSIONS.menuRead].some(
        (code) => user.permissions.includes(code),
      );
      if (resource === 'catalog' && method === 'GET' && !id) {
        return catalogAccess
          ? send(res, 200, system.catalog())
          : send(res, 403, null, '没有系统管理权限');
      }
      if (resource === 'audit' && method === 'GET' && !id) {
        return user.permissions.includes(PERMISSIONS.userRead) &&
          user.permissions.includes(PERMISSIONS.roleRead)
          ? send(res, 200, system.audit())
          : send(res, 403, null, '没有审计查看权限');
      }
      if (!['users', 'roles', 'menus'].includes(resource))
        return send(res, 405, null, '不支持的请求方法');
      if (
        !user.permissions.includes(readPermission) ||
        (method !== 'GET' && !user.permissions.includes(writePermission))
      )
        return send(res, 403, null, '没有此操作权限');
      if (method === 'GET' && !id) {
        if (resource === 'menus') return send(res, 200, system.menus());
        const page = Number(url.searchParams.get('page') ?? 1),
          pageSize = Number(url.searchParams.get('pageSize') ?? 20);
        if (
          !Number.isInteger(page) ||
          page < 1 ||
          !Number.isInteger(pageSize) ||
          pageSize < 1 ||
          pageSize > 100
        )
          return send(res, 400, null, '分页参数错误');
        const keyword = (url.searchParams.get('keyword') ?? '').trim().toLowerCase();
        const records =
          resource === 'users'
            ? system
                .users()
                .filter((item) =>
                  `${item.username} ${item.displayName} ${item.email}`
                    .toLowerCase()
                    .includes(keyword),
                )
            : system
                .roles()
                .filter((item) =>
                  `${item.code} ${item.name} ${item.description}`.toLowerCase().includes(keyword),
                );
        return send(res, 200, {
          list: records.slice((page - 1) * pageSize, page * pageSize),
          page,
          pageSize,
          total: records.length,
        });
      }
      if (!(
        (method === 'POST' && !id && resource !== 'menus') ||
        (method === 'PATCH' && id) ||
        (method === 'DELETE' && id && resource !== 'menus')
      ))
        return send(res, 405, null, '不支持的请求方法');
      let data;
      try {
        data = await body(req);
      } catch {
        return send(res, 400, null, '请求体格式错误');
      }
      const actor = system.session(user.id);
      if (!actor) return send(res, 401, null, '登录已过期，请重新登录');
      if (![readPermission, writePermission].every((code) => actor.permissions.includes(code)))
        return send(res, 403, null, '没有此操作权限');
      try {
        if (resource === 'users') {
          if (method === 'DELETE') {
            system.deleteUser(actor, id!, data);
            return send(res, 200);
          }
          const saved = system.saveUser(actor, id, data);
          if (id && data.password)
            for (const [key, value] of sessions) if (value.userId === id) sessions.delete(key);
          return send(res, 200, saved);
        }
        if (resource === 'roles') {
          if (method === 'DELETE') {
            system.deleteRole(actor, id!, data);
            return send(res, 200);
          }
          return send(res, 200, system.saveRole(actor, id, data));
        }
        return send(res, 200, system.saveMenu(actor, id!, data));
      } catch (error) {
        if (error instanceof SystemError) return send(res, error.status, null, error.message);
        throw error;
      }
    }
    return send(res, 404, null, '接口不存在');
  };
}

export function mockApiPlugin(): Plugin {
  return {
    name: 'development-session-api',
    apply: 'serve',
    configureServer(server) {
      const handle = createMockApi();
      server.middlewares.use((req, res, next) => {
        void handle(req, res, next).catch(() => {
          if (!res.headersSent) {
            res.statusCode = 500;
            res.end('Mock API error');
          }
        });
      });
    },
  };
}
