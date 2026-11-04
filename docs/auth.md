# 登录、会话与权限

当前交付是可对接生产后端的前端权限模块，并附带仅开发环境使用的会话 API 模拟服务。仓库没有真实用户数据库或生产认证服务，不能将 mock/server.ts 直接作为生产认证后端。

## 本地运行

```sh
pnpm mock
```

| 用户名 | 密码 | 可用权限 |
| --- | --- | --- |
| admin | Demo@123456 | 全部业务及系统管理权限 |
| viewer | Demo@123456 | 设备查看 |
| tester | Demo@123456 | WebSocket 演示 |

这些账号只存在于 Node 开发中间件。普通 `pnpm dev` 和生产构建不会开启 Mock；生产包也不包含上述演示密码。

## 职责

- `stores/auth.ts`：Pinia 管理用户、权限、初始化和请求世代，不持久化认证数据。
- `auth/permissions.ts`：权限码、统一的全部满足判定、会话响应结构校验。
- `router/access.ts`：默认登录保护、逐层路由授权、安全回跳和按权限选择首页。
- `router/routes.ts`：页面权限要求；只有显式 `public: true` 的路由允许匿名访问。
- `AppMenu.vue`：仅显示有权访问的路由；隐藏菜单不代替路由和后端授权。
- `DeviceList.vue` / `DeviceEditDialog.vue`：设备查看、编辑入口、保存权限校验。
- `net/axios`：Cookie/CSRF 配置、统一 401 通知，保留原始 Axios 错误。
- `mock/server.ts`：本地 HTTP 会话、CSRF 和接口授权示例，开发进程退出后数据和会话丢失。
- `mock/devices.ts`：设备模拟数据、查询和分页，统一由模拟服务调用。

角色由后端映射成权限码。前端不判断角色名字，不给 admin 名称或通配符特殊待遇。权限目录见 `auth/permissions.ts`，包含设备、开发演示，以及用户、角色、菜单的查看和管理权限；数组要求全部满足。

```ts
const auth = useAuthStore()
auth.can(PERMISSIONS.deviceUpdate)
```

```vue
<el-button v-if="auth.can(PERMISSIONS.deviceUpdate)">编辑</el-button>
```

当前使用响应式 v-if 控制操作，未添加一次性移除 DOM 的权限指令，避免权限变化后页面不同步。

## 会话与后端约定

采用同源 HttpOnly Cookie 会话。会话标识由服务端设置并校验，前端不从 localStorage 读取或保存 Token、角色和权限；刷新后向服务端重新获取会话。Axios 的可选 getToken hook 仅供需要显式 Bearer 的其他客户端使用，当前应用没有配置。

生产推荐会话 Cookie 形态：

```http
Set-Cookie: __Host-session=<opaque-id>; Path=/; HttpOnly; Secure; SameSite=Lax
Cache-Control: no-store
```

不要设置 Domain。Mock 为了本地 HTTP 使用 mock-session 且不加 Secure，不能原样用于生产。

所有接口继续使用业务信封：

```json
{
  "code": 200,
  "message": "ok",
  "data": {
    "id": "user-id",
    "username": "alice",
    "displayName": "Alice",
    "roles": ["viewer"],
    "permissions": ["devices:read"]
  }
}
```

| 接口 | 行为 |
| --- | --- |
| GET /api/auth/csrf | 设置可读 XSRF-TOKEN Cookie，返回 data: null；响应禁止缓存 |
| POST /api/auth/login | JSON username/password；检查 CSRF 和来源，验证凭据，轮换会话 ID，设置 HttpOnly Cookie，返回用户 |
| GET /api/auth/session | 验证当前会话，返回用户和最新权限；无有效会话返回 HTTP 401；保证有效的 CSRF Cookie 可用 |
| PATCH /api/auth/profile | 校验会话、CSRF 和资料字段白名单，只修改当前用户资料；返回完整用户，禁止修改角色/权限/ID |
| POST /api/auth/logout | 检查 CSRF，撤销服务端会话并清除 Cookie；返回 data: null，重复退出可返回 200 或 401 |
| GET /api/devices | 每次校验会话与 devices:read，返回分页数据 |
| PATCH /api/devices/:id | 校验会话、CSRF、devices:read 和 devices:update、对象归属、字段白名单；原子检查 version 后更新 |

HTTP 错误也返回同样信封，code 对应 HTTP 状态。401 表示未认证，403 表示认证后没有权限，409 表示版本冲突。不要把错误当成成功响应。

浏览器在同源请求中由 Axios 自动把 XSRF-TOKEN Cookie 放入 X-XSRF-TOKEN 请求头。后端必须校验其有效性、会话绑定和来源，不能仅检查头存在。跨域部署需要另行设计允许来源与凭据策略；当前方案优先同源 /api 反向代理。

## 关键行为

- 初始访问、每次导航和标签重新获得焦点时向服务端确认会话；并发会话请求合并。
- 登录成功只接受已知结构的会话响应。登录回跳只允许站内且有权限的目标。
- 登录后优先进入有权访问的业务页面；无业务权限时进入个人中心，仍可管理自己的资料。访问未授权业务页面继续显示 403。
- 权限撤回会更新菜单和编辑列；会话失效清除用户并隐藏受保护内容。
- 不同用户的页面实例重新创建，避免在跨标签切换账号后继续显示前一个账号的数据。
- 网络故障不冒充会话过期；进入可重试的会话错误页。
- 旧会话的迟到响应不能恢复已退出用户，迟到 401 不会清除新会话。
- 退出请求网络失败会明确报错并保留当前状态，不声称已经撤销服务端会话。
- 设备编辑通过接口保存，支持亮度 0；版本冲突明确提示刷新。
- Cookie 会话不让前端获知到期时间；最终过期与撤销判断以服务端为准。

## 生产后端仍需实现

本仓库没有真实后端。上线需由实际服务完成：密码哈希或接入身份提供方、登录限流与审计、共享会话存储和吊销、空闲/绝对过期、登录时会话轮换、CSRF 会话绑定、HTTPS、安全 Cookie、逐接口与对象级授权、原子版本更新，以及反向代理的 history 回退和缓存配置。不要把前端角色信息、隐藏按钮或 Mock 的内存 Map 当作安全边界。

用户、角色、权限分配和菜单配置已实现，入口为「系统管理」。实现边界、接口和生产对接要求见 [system.md](./system.md)。当前仍未实现 MFA。

## 验证

```sh
pnpm test
pnpm test:e2e
pnpm build
```

E2E 默认使用已安装的 Edge。其他环境安装 Playwright Chromium，并设置 PLAYWRIGHT_CHANNEL=chromium 后运行。测试包括真实浏览器 Cookie/CSRF、刷新恢复、三种账号、无权直达、设备保存、会话过期和跨标签退出。本地 HTTP 测试还验证绕过 UI 直接请求会被拒绝。

参考：[OWASP Session Management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)、[OWASP Authorization](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)、[Pinia 在组件外使用 Store](https://pinia.vuejs.org/core-concepts/outside-component-usage.html)。

顶部导航、头像详情、个人资料字段和接口扩展见 [navigation.md](./navigation.md)。
