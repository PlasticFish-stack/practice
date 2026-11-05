# 目录约定

- `views/`：路由直接加载的页面。页面专用组件放在相应页面的 `components/` 下。
- `layouts/`：后台整体布局；侧栏、菜单、内容区放在 `layouts/components/`。
- `components/`：不依赖设备业务类型的公共 UI 组件；组件配套类型放在组件旁边。
- `composables/`：带 Vue 状态或作用域清理的逻辑，以 `use` 开头命名。
- `api/`：具体业务接口和共享 HTTP 客户端实例。
- `net/`：请求基础封装。
- `types/`：业务数据类型。
- `tests/`：自动化测试。

以上业务目录位于 `src/`；`tests/` 位于项目根目录。

开发模拟服务统一放在项目根目录 `mock/`：`server.ts` 是 Vite 中间件入口，处理会话、权限及接口路由；`devices.ts` 提供设备模拟数据、筛选和分页；`system.ts` 管理用户、角色、权限分配及菜单配置。运行 `pnpm mock` 时启用，普通 `pnpm dev` 和生产构建不启用模拟服务。前端只通过 HTTP 调用接口，不导入 `mock/`。

入口：`App.vue → DefaultLayout → AppMain 的 RouterView → DeviceList`。

现有地址 `/device`、`/login` 保留。独立 WebSocket 演示位于 `/playground/websocket`，需要手动连接外部 echo 服务。

设备页面负责查询参数和加载数据；DeviceSearch 负责输入、搜索和重置；AppPagination 只上报分页参数；AppTable 负责表格展示。

路由配置放在 `router/routes.ts`，实例和导航钩子放在 `router/index.ts`。新增页面时配置唯一 `name` 和 `meta.title`；设定 `meta.menu: true` 后会按路由树生成侧栏，父子权限同时生效，`meta.icon` 对应已注册的图标名称。面包屑读取当前匹配路由的标题。

`/` 根据菜单顺序和权限优先进入可访问的功能页，个人中心作为没有其他功能权限时的回退；未匹配地址显示 404；`/login` 不使用后台布局。登录和权限接入说明见 [auth.md](./auth.md)。使用 HTML5 history，部署服务需要将前端页面地址回退到 `index.html`。

WebSocket 新导入方式：

```ts
import { useWebSocket } from '@/composables/useWebSocket';
```

通用终端位于 `components/AppTerminal/`，演示页为 `views/playground/TerminalDemo.vue`，本地演示和网关适配与渲染组件分开。接口和后端接入约定见 [terminal.md](./terminal.md)。

通用图表位于 `components/AppChart/`，集中管理 ECharts 按需注册、主题和生命周期；页面负责数据与原生 option。图表演示为 `views/playground/ChartsDemo.vue`，使用说明见 [charts.md](./charts.md)。

SSE 新导入方式：

```ts
import { useSSE } from '@/composables/useSSE';
```

多级菜单和宽度配置见 [menu.md](./menu.md)。

用户、角色、权限和菜单管理见 [system.md](./system.md)。

多页签、KeepAlive 缓存和生命周期约定见 [page-tabs.md](./page-tabs.md)。

公共表单、表格和分页的配置、插槽与用法见 [components.md](./components.md)。

全局颜色、间距、圆角、阴影与 Element Plus 主题映射见 [theme.md](./theme.md)。
