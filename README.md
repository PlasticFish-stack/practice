# 后台管理基座

Vue 3 + TypeScript + Vite + Element Plus + Pinia，使用 Composition API 和 `<script setup>`。当前包含设备管理示例、系统管理和开发演示，可在此基础上接入自己的业务后端。

## 启动

```sh
pnpm install
pnpm mock
```

访问终端输出的本地地址。演示账户密码均为 `Demo@123456`：

| 账户   | 演示权限                                 |
| ------ | ---------------------------------------- |
| admin  | 设备、用户、角色、菜单管理及全部开发演示 |
| tester | 开发演示、自己的个人中心                 |
| viewer | 查看设备、自己的个人中心                 |

`pnpm mock` 启用根目录 `mock/` 下的 HTTP 模拟服务，数据保存在开发进程内，重启会重置。`pnpm dev` 不启用模拟服务，需要提供真实同源 `/api` 服务。演示账户和模拟授权仅用于本地开发。

## 功能与目录

- 导航：权限过滤、多级菜单、面包屑、页面搜索和头像菜单。
- 工作空间：多页签、KeepAlive、独立刷新、关闭清理、明暗主题和窄屏布局。
- 系统：用户、角色、菜单配置；个人中心内直接编辑资料。
- 公共组件：表单、普通/虚拟表格、分页、图表、Web 终端。
- 连接适配：Axios、WebSocket、SSE；SSH 终端网关仍需自己的后端。

```text
src/
  api/          业务接口
  auth/         权限、导航目录和账户约定
  components/   通用 UI 组件
  composables/  Vue 连接与交互逻辑
  layouts/      布局、侧栏、页签和页面容器
  net/          HTTP 基础封装
  router/       路由、守卫和菜单构建
  stores/       会话、外观偏好和页签状态
  styles/       主题 token、Element Plus 和菜单样式
  types/        业务类型
  views/        路由页面与页面专用组件
mock/           仅开发环境使用的 HTTP 服务
tests/          单元、接口、类型与浏览器测试
docs/           组件和后端接入说明
```

导航入口按设备 → 系统管理 → 开发演示排列；具体权限和服务端菜单配置决定最终可见项。首页优先进入可访问的功能页面，只有个人账户能力时进入个人中心。

## 开发检查

```sh
pnpm format:check # 检查格式
pnpm lint         # 检查代码规范
pnpm test         # 单元与接口测试
pnpm build        # vue-tsc 类型检查和生产构建
pnpm test:e2e     # 浏览器测试，自动启动独立的 mock 服务
```

浏览器测试默认使用本机 Edge。也可安装 Playwright Chromium 后通过环境变量 `PLAYWRIGHT_CHANNEL=chromium` 运行。测试服务使用 5174 端口和独立的 `node_modules/.vite-e2e` 缓存，避免与日常开发的依赖预构建互相覆盖。

Vite 会提前预构建 Element Plus 自动导入的样式入口，避免首次访问新页面时依赖重新优化引发重载；相关机制见 [Vite 依赖预构建说明](https://vite.dev/guide/dep-pre-bundling/)。这仅影响开发服务，不会将全部组件样式加入生产包。

Prettier 负责格式，ESLint 负责代码检查。VS Code 推荐扩展和保存时格式化已配置；`pnpm format` / `pnpm lint:fix` 可主动修复。Husky 提交前运行格式检查和 lint，不自动暂存文件。

## 接后端与部署

运行监控已并入统一工作区登录，入口为 `/overview`（旧 `/observe` 自动跳转）。首次设置独立工作区账号后，通过 HttpOnly Cookie 恢复登录，切菜单和刷新无需再输令牌。开发代理通过 `XRAY_API_TARGET` 配置（可放在 `.env.local`），生产环境使用同源 `/api/v1`。功能范围、联调及验证说明见 [观察面板](docs/observer.md)。

```sh
pnpm build
pnpm preview
```

生产部署发布 `dist/`。HTML5 History 路由需要将前端页面请求回退到 `index.html`；`/api` 和 WebSocket 请求应转发到真实后端，不要回退成 HTML。`pnpm preview` 仅供本地检查构建结果，不提供模拟 API。

认证使用会话 Cookie，写操作携带 CSRF token，后端必须再次校验身份和权限。终端页面只提供前端渲染与网关协议，不会直接连接或操作 VPS。图表、终端和设备演示中的示例数据不代表真实监控结果。

## 文档

- [目录约定](docs/structure.md)、[菜单与扩展](docs/menu.md)、[导航与个人资料](docs/navigation.md)
- [认证与后端接口](docs/auth.md)、[系统管理](docs/system.md)
- [表单与表格](docs/components.md)、[图表](docs/charts.md)、[Web 终端](docs/terminal.md)
- [多页签与缓存](docs/page-tabs.md)、[主题](docs/theme.md)、[SSE](docs/sse.md)
