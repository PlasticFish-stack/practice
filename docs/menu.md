# 多级侧栏菜单

菜单直接读取 `router/routes.ts` 的路由树，使用 `AppMenuItem.vue` 递归渲染。菜单结构由路由层级决定，不按 URL 斜杠猜层级。

当前实际菜单：

```text
系统管理
├─ 用户管理
├─ 角色管理
├─ 菜单管理
└─ 个人中心
```

基础版默认注册用户、角色、菜单和个人中心；业务页面自行扩展注册。

菜单随侧栏独立滚动，长菜单不会把整个页面撑高；主导航提供独立的无障碍名称。默认排序在路由元信息与 `auth/navigation.ts` 中保持一致，已有服务端排序优先，升级时不会覆盖管理员保存的设置。

图标通过 `components/menuIcons.ts` 的组件白名单按需加载，未知名称显示文档图标。新增可配置图标时同步修改该映射与 `MENU_ICONS`，TypeScript 会检查白名单是否齐全；页面内固定图标直接在组件中导入。

个人中心为 `/account/center`；`?edit=1` 在同一页面打开资料编辑，刷新保持编辑状态。`/account` 重定向到个人中心，旧 `/account/settings` 自动跳转到个人中心的编辑状态，并保留其他查询参数和 hash。所有登录用户可访问自己的个人页面，业务菜单继续按业务权限显示；无业务权限时首页进入个人中心。

## 增加层级

```ts
{
  path: 'reports',
  name: 'reports',
  redirect: { name: 'daily-report' },
  meta: { title: '报表', menu: true, menuOrder: 30, icon: 'FolderOpened' },
  children: [
    {
      path: 'daily',
      name: 'daily-report',
      component: () => import('@/views/reports/DailyReport.vue'),
      meta: { title: '日报', menu: true, permissions: [/* 已定义的权限码 */] },
    },
  ],
}
```

这是配置格式示例，项目没有创建报表页面。继续添加 children 即可增加层级。纯分组路由可以不设 component；如设置 component，则应提供子路由的 RouterView。分组如需支持直接访问，应配置到实际页面的 redirect。

系统管理分组由权限守卫选择首个可访问子页面。已注册页面的名称、排序、可见性等可在「系统管理 → 菜单管理」配置，细节见 [system.md](./system.md)。会话中的配置覆盖展示元数据，但不会移除原始路由的权限要求。

约定：

- 可见菜单需要唯一的字符串 name、meta.title、meta.menu: true。
- 相对 path 由 Vue Router 解析成完整地址，也支持绝对 path。
- meta.menuOrder 在同级中升序排列，未设置时为 0。
- 未显示的布局路由会透传子菜单；其权限要求仍会生效。
- 无权限的分支整支隐藏，纯分组没有可见子项时隐藏。
- 带隐藏详情路由的实际页面仍可作为末级菜单。
- 默认首页选择可访问的末级页面，不停在纯分组上。
- 选中态按命名路由定位；隐藏详情页继承最近的可见菜单祖先。
- 直接进入末级页面会展开其菜单祖先。折叠后的子菜单弹出交互由 Element Plus 管理。
- 自动展开只响应选中菜单变化、首次挂载和侧栏恢复展开；会话与菜单数据刷新不覆盖手动收起状态，避免切换页面前重新展开旧页面的分组。

## 宽度与长标题

根菜单默认展开宽度 220px，折叠宽度 64px，子菜单和弹出层不复用根宽度。外层 `.menu-viewport` 负责宽度过渡和裁剪；内部菜单直接切换完整布局，并关闭 Element Plus 的 `collapse-transition`，避免原生离场动画延迟文字显示。展开期间子菜单保持完整宽度；系统要求减少动画时取消宽度过渡。

可以在全局样式或布局祖先上配置：

```css
#app {
  --app-sidebar-menu-width: 260px;
}
```

该变量控制根菜单宽度，不包含侧栏外层的 padding 和边框。多层菜单共享根菜单空间并逐级缩进；长标题省略，悬停标题可通过原生 title 提示查看完整文字。

递归支持继续增加层级，但可用宽度仍是有限的；层级很深时应调整菜单信息结构或根菜单宽度。

## 外观与间距

侧栏间距参照用户指定的 [Ant Design Pro 预览](https://preview.pro.ant.design/welcome/)；菜单与 Select 在浅色、深色下均使用实心主题色选中底色及浅色文字。

- 菜单项高 `40px`，四周 margin `4px`，左右基础 padding `16px`，圆角 `6px`。
- 侧栏容器 padding `8px`，图标 `14px`，图标与文字间隔 `8px`。各层色块保持统一宽度，文字每层缩进 `8px`，累计最多 `24px`，深层标题省略；不绘制父子连接线。
- 子菜单视觉上直接展开，内部保留 `1ms` 过渡供原生 Transition 清理高度，避免设为零后生命周期先于异步高度写入完成。侧栏整体宽度仍保留过渡。
- 普通文字为 `rgba(0,0,0,.65)`，hover 为 `rgba(0,0,0,.88)`，hover 底色为 `rgba(0,0,0,.03)`。
- 选中项使用 `--app-color-selected-bg` 底色及 `--app-color-selected-text` 文字，hover 后保持选中态。展开时所有父分组使用 `--app-menu-ancestor-bg` 浅主题色底及 `--app-menu-ancestor-color` 文字；收起时当前父分组使用实心选中底色。
- 深色使用对应的白色透明色；折叠后图标居中。展开到 body 的子菜单也使用相同间距及状态，并重新从基础 padding 开始，不累加侧栏缩进。

变量集中在 `styles/theme.css` 的 `--app-menu-*` 部分，样式在 `styles/menu.css`。折叠浮层通过 `AppMenuItem` 的 `popper-class="app-menu-popper"` 接入，不覆盖其他水平导航的样式。

实现文件：

- `router/menu.ts`：树形菜单、排序、权限裁剪、查找末级和祖先链。
- `router/access.ts`：路由访问控制与默认首页。
- `layouts/components/AppMenu.vue`：根菜单宽度、选中态、展开当前分支。
- `layouts/components/AppMenuItem.vue`：递归分组和末级菜单、标题省略。

运行 `pnpm test` 和 `pnpm test:e2e`。测试中的四级菜单只在浏览器测试响应内注入，不进入生产路由。
