# 工作空间导航与账户信息

布局参考 [Ant Design Pro 预览页](https://preview.pro.ant.design/welcome/)，保留 Vue 3、Element Plus 和已有的权限逻辑。

## 界面与行为

- 56px 顶部导航：当前页面标题、移动端侧栏折叠、导航搜索、帮助、全屏、主题、头像。基础版本不包含品牌 Logo，标题随路由切换，优先使用服务端菜单名称，与页签和面包屑一致。
- 顶部不再显示 Workspace 副标题。顶部折叠按钮仅在 760px 及以下显示，桌面端使用侧栏边缘的折叠按钮；两者共用状态，窄屏默认折叠。
- 网页名称为「后台管理」，基础版本不包含品牌浏览器图标或 Apple 触屏图标。
- 界面图标统一使用本地 Material Symbols Outlined（`src/components/icons`），包括菜单、工具栏、表格操作和 Element Plus 内置控件图标。Vite 将 Element Plus 的图标导入映射到同一模块；服务端菜单仍使用原有图标名称。来源与许可证见该目录的 `NOTICE.md` 和 `LICENSE`，更新方式为运行 `node scripts/sync-material-icons.mjs` 后格式化生成文件。
- 侧栏仅保留导航及折叠按钮，不包含人物或吉祥物插画。
- 内容区顶部包含可关闭的多页签栏及 KeepAlive 页面缓存，支持页面状态保留、独立刷新、批量关闭和权限清理，详见 [page-tabs.md](./page-tabs.md)。
- 面包屑和页面标题来自当前路由。
- 搜索快捷键：Windows/Linux 使用 Ctrl+K，macOS 使用 ⌘+K；支持上下键和回车跳转，仅展示可访问页面。
- 头像下拉展示昵称、邮箱/用户名、角色，并提供个人中心、个人设置、退出登录。主题切换统一使用顶部独立入口；头像及主题下拉的选项与 Select 共用圆角、间隔和主题色选中态。
- 头像菜单容器上下 padding `8px`、左右 `4px`，为选项与面板边缘留白；选项内部沿用公共 Dropdown 的 padding 与 `32px` 最小行高。
- 个人中心与用户、角色、菜单配置统一位于系统管理分组，保留 `/account/center` 地址。头像“个人中心”进入查看状态，“个人设置”直接进入同页编辑状态。所有已登录用户均可访问自己的个人页面；没有管理权限的用户在系统管理下只看到个人中心。
- 个人中心展示会话中的账户资料、角色和权限。
- 个人中心内可编辑昵称、邮箱、电话、部门、职位、简介和头像图片地址。取消丢弃草稿，保存成功后回到查看状态；失败保留输入并显示错误。旧个人设置地址兼容跳转到 `/account/center?edit=1`。
- 没有头像或图片加载失败时，回退到昵称首字头像。
- 支持浅色、深色和跟随系统，使用 ui.theme 保存浏览器外观偏好；认证信息不存入浏览器存储。

参考站点的版本切换与国际化入口没有照搬成无实际功能的按钮。当前帮助入口提供应用使用说明；未接入消息服务，因此没有虚构通知或未读数。

## 会话字段与保存接口

SessionUser 新增可选字符串字段：avatarUrl、email、phone、title、department、bio。旧会话接口不提供这些字段时，界面显示默认头像和未填写状态。

新增接口：

```http
PATCH /api/auth/profile
Content-Type: application/json
X-XSRF-TOKEN: <CSRF token>
```

```json
{
  "displayName": "Alice",
  "email": "alice@example.test",
  "phone": "",
  "department": "系统运营",
  "title": "系统管理员",
  "bio": "负责工作空间中的系统运营。",
  "avatarUrl": ""
}
```

返回标准响应信封，data 为服务端保存后的完整 SessionUser。昵称必填，其他字段可以为空。角色、权限、用户名、用户 ID 不接受从此接口修改。服务端必须从当前会话确定用户，不接受客户端指定其他用户 ID。

本地 Mock 已实现该接口、CSRF 校验和字段白名单，保存结果保留到开发服务重启。生产后端需要实现相同契约并持久化到用户存储；未接入后端时界面会显示错误，不会伪装保存成功。

头像当前使用 HTTPS 图片地址或本站路径，未提供文件上传接口。可以后续对接文件服务并将得到的图片地址保存到 avatarUrl。禁止 javascript、data、协议相对地址和带凭据的 URL。

## 文件职责

- `AppHeader.vue`：顶部工具导航、帮助和主题入口。
- `AppNavigationSearch.vue`：按权限搜索页面及键盘交互。
- `AppAccountMenu.vue`：头像下拉及退出登录。
- `UserAvatar.vue`：头像展示和文字回退。
- `AccountCenter.vue`：账户详情及基于 URL 的查看/编辑切换；`components/ProfileEditor.vue`：资料表单、保存和头像预览。
- `stores/preferences.ts`：仅管理本地外观偏好。
- `auth/profile.ts`：资料字段与校验。

验证命令：pnpm test、pnpm test:e2e、pnpm build。
