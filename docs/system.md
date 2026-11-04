# 系统管理

个人中心作为独立侧栏入口，保留 `/account/center` 和旧设置 URL。新增系统管理分组：

| 页面 | 路径 | 查看权限 | 修改权限 |
| --- | --- | --- | --- |
| 用户管理 | `/system/users` | `system:users:read` | `system:users:write` |
| 角色管理 | `/system/roles` | `system:roles:read` | `system:roles:write` |
| 菜单管理 | `/system/menus` | `system:menus:read` | `system:menus:write` |

用户支持搜索、分页、新增、编辑、角色分配、停用、密码重置和删除。角色支持新增、编辑、停用、删除和权限分配；权限目录按业务分组展示，操作权限关联查看权限。页面复用 AppTable、AppForm，编辑器各自持有草稿，失败时保留输入。

## 授权与并发

- 服务端从用户分配的启用角色合并权限，逐个请求重新计算。角色停用或权限撤销后，已有 Cookie 也不能继续调用被撤销的接口；前端在导航、重新聚焦以及管理操作完成后刷新会话。
- 停用、删除账号使其会话无法继续使用；重置密码撤销该账号的全部会话。
- 查看、修改分别检查权限，写请求还要求 CSRF、字段白名单、数据版本和有效引用。不能授予自己未拥有的权限，不能通过修改高权限用户或重置其密码提升权限。
- 内置管理员角色不可编辑或删除；不能停用、删除当前账号，并始终保留至少一个启用的内置管理员。已分配角色必须先解除用户关联才能删除。
- 更新和删除请求携带读取时的 `version`。冲突返回 409，不自动覆盖其他人的修改；界面保留草稿，需取消、刷新后重新编辑。
- 模拟服务记录最近 200 次管理变更的操作者、目标和时间，不记录密码。`GET /api/system/audit` 要求用户查看和角色查看权限。

## 菜单配置

`auth/navigation.ts` 登记可配置的页面，组件和 URL 固定在应用路由中；服务端不接收任意组件路径、脚本 URL 或未注册路由。配置支持名称、图标、排序、显示状态和访问权限。

菜单权限可以追加限制，不能移除页面原本需要的权限；侧栏与直接路由均校验父子层级的访问权限。隐藏仅改变导航展示，不撤销接口权限。个人中心、系统分组及菜单管理入口保留必要的可见性与权限。

`SessionUser.navigation` 返回配置，Pinia 会话作为前端唯一数据来源；侧栏、导航搜索、面包屑和页面标题同步使用配置。其他浏览器会话在导航或重新聚焦时获得新配置。

## 接口

统一 `{ code: 200, message, data }` 成功信封，HTTP 400/401/403/404/409 返回对应错误码。

- `GET /api/system/users`、`GET /api/system/roles`：`keyword`、`page`、`pageSize`；返回 `{ list, page, pageSize, total }`，每页最多 100 条。
- `POST /api/system/users`、`PATCH /api/system/users/:id`：用户名（创建后不可更改）、显示名称、邮箱、`roleIds`、`enabled`、密码；更新带 `version`。编辑时密码为空表示保留原密码。
- `POST /api/system/roles`、`PATCH /api/system/roles/:id`：角色编码（创建后不可更改）、名称、描述、启用状态、权限码数组；更新带 `version`。
- `DELETE /api/system/users/:id`、`DELETE /api/system/roles/:id`：请求体 `{ version }`。
- `GET /api/system/menus`、`PATCH /api/system/menus/:routeName`：读取完整菜单配置或修改允许的展示、授权字段，更新带 `version`。
- `GET /api/system/catalog`：角色选项、权限目录及图标选项，要求至少一项系统管理查看权限。

## 生产对接边界

前端通过 `api/system.ts` 调用接口，数据处理位于根目录 `mock/system.ts`，HTTP 授权位于 `mock/server.ts`。演示数据、会话和审计仅在开发进程内存中保存，重启重置。新增、重置密码使用随机盐与 scrypt，不向前端返回凭据字段。

这些是可运行的开发接口，尚不是生产后台：上线需替换为数据库、数据库唯一约束、事务和原子版本更新、持久审计、生产会话与密码策略。生产服务必须执行同样的授权和越权保护；前端的隐藏、禁用不代替接口授权。
