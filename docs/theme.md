# 全局主题

主题参照 [Ant Design 的 Design Token](https://ant.design/docs/react/customize-theme/) 与 [Ant Design Pro 预览](https://preview.pro.ant.design/welcome/)，继续使用 Element Plus。

## 修改入口

- `src/styles/theme.css`：项目变量、深色变量，以及 `--el-*` 的映射。
- `src/styles/element-plus.css`：Element Plus 的局部变量与编译期样式适配，例如卡片、弹窗、表格 padding 和控件交互状态。
- `src/styles/menu.css`：参照 Pro 预览的侧栏与折叠浮层，包含状态、行高、内外边距和多级缩进；变量为 `--app-menu-*`，详见 [menu.md](./menu.md)。
- `src/style.css`：字体、页面背景和根容器等基础样式。根容器、登录页和后台布局统一使用 `dvh` 视口高度；需要把 padding、边框计入声明宽度的容器单独设置 `box-sizing: border-box`。

在 `main.ts` 中先载入 Element Plus 深色变量，再加载项目主题。变量定义在 `html`，传送到 `body` 的菜单、下拉和弹窗也能继承；选择器优先级覆盖按需加载的默认 CSS，避免换页面后主题被覆盖。

## 主要变量

| 用途                          | 变量                                                                                                          | 浅色默认值                         |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| 品牌主色                      | `--app-color-primary`                                                                                         | `#1677ff`                          |
| 主色 hover / active           | `--app-color-primary-hover` / `--app-color-primary-active`                                                    | `#4096ff` / `#0958d9`              |
| 主色弱化 / 边框 / 背景        | `--app-color-primary-muted` / `--app-color-primary-border` / `--app-color-primary-bg`                         | `#91caff` / `#bae0ff` / `#e6f4ff`  |
| 成功 / 警告 / 错误            | `--app-color-success` / `--app-color-warning` / `--app-color-danger`                                          | `#52c41a` / `#faad14` / `#ff4d4f`  |
| 正文 / 次要文字 / 提示 / 禁用 | `--app-color-text` / `--app-color-text-secondary` / `--app-color-text-tertiary` / `--app-color-text-disabled` | 黑色透明度 `88% / 65% / 45% / 25%` |
| 控件边框 / 分隔线             | `--app-color-border` / `--app-color-border-secondary`                                                         | `#d9d9d9` / `#f0f0f0`              |
| 页面 / 内容 / 浮层背景        | `--app-color-layout` / `--app-color-surface` / `--app-color-elevated`                                         | `#f5f5f5` / `#fff` / `#fff`        |
| 小 / 默认 / 大圆角            | `--app-radius-sm` / `--app-radius-base` / `--app-radius-lg`                                                   | `4px / 6px / 8px`                  |
| 轻阴影 / 浮层阴影 / 卡片阴影  | `--app-shadow-sm` / `--app-shadow-popup` / `--app-shadow-card`                                                | 分层阴影，普通业务卡片为 `none`    |
| 间距尺度                      | `--app-space-2xs` 至 `--app-space-2xl`                                                                        | `4 / 8 / 12 / 16 / 24 / 32 / 48px` |
| 页面 / 卡片 padding           | `--app-page-padding` / `--app-card-padding`                                                                   | `24px`，窄屏 `16px`                |
| 表单字段间距                  | `--app-form-gap`                                                                                              | `24px`                             |
| 默认输入框左右 padding        | `--app-control-padding-inline`                                                                                | `11px`                             |
| 小 / 默认 / 大控件高度        | `--app-control-height-sm` / `--app-control-height` / `--app-control-height-lg`                                | `24px / 32px / 40px`               |
| 默认表格上下 / 左右 padding   | `--app-table-padding-block` / `--app-table-padding-inline`                                                    | `12px / 16px`                      |

圆角、边框和间距参考官方 Token。表格采用适合后台的中等密度：默认上下 `12px`，`size="large"` 为 `16px`，`size="small"` 为 `8px`；对应 [Ant Design Table 的密度层级](https://ant.design/components/table/#design-token)。卡片 padding 参照 [Card Token](https://ant.design/components/card/#design-token)，输入 padding 参照 [Input Token](https://ant.design/components/input/#design-token)。

项目保留 Ant Design 默认品牌蓝。官方 Pro 预览可以自定义主色，因此实际预览局部配置不一定与 Ant Design 的默认主色相同。状态色的 Element Plus 明暗色阶使用 `color-mix()` 随表面色派生；它们是项目适配，并非完整移植 Ant Design 的调色算法。

## 如何使用

菜单与 Select 共用选中态 `--app-color-selected-bg` / `--app-color-selected-text`：浅色、深色均为实心主题色底配浅色文字。菜单的选中祖先分支使用较浅的主题色底与主题色文字，与当前叶子页面区分。

输入框、下拉框及多行文本框仅保留原生 1px 内边框，聚焦无额外光晕、边框无渐变。普通、plain、dashed 按钮在 hover / 按下时保持背景和文字，仅边框显色；text / link 保留无边框结构与静止态背景。实心按钮保留原生反馈，禁用态及键盘焦点提示继续生效。

普通 Select 下拉选项采用独立圆角高亮：面板上下 padding `4px`，相邻选项上下间隔 `4px`，左右 margin `4px`、文字左 padding `8px`、圆角 `4px`。选中项使用上述统一选中态，hover 为浅灰；样式同时覆盖分页的每页条数选择器。变量为 `--app-select-dropdown-padding`、`--app-select-option-gap`、`--app-select-option-margin`、`--app-select-option-padding`、`--app-select-option-radius`。不覆盖 Select V2 虚拟列表的行高与定位。

表格斑马纹使用实色 `--app-color-table-stripe`，避免固定列透出下方单元格；不要将这个变量替换为半透明填充色。

公共组件与业务页面都消费同一套变量：

```css
.business-card {
  padding: var(--app-card-padding);
  border: var(--app-border-secondary);
  border-radius: var(--app-radius-lg);
  background: var(--app-color-surface);
  box-shadow: var(--app-shadow-card);
}
```

只调整一个区域时，可以在该区域覆盖项目变量：

```css
.compact-workspace {
  --app-card-padding: var(--app-space-md);
  --app-table-padding-block: var(--app-space-xs);
}
```

浮层通常传送到 `body`，区域内的覆盖不会自动传给浮层。需要影响浮层时，在主题根节点调整，或给对应浮层指定 class 再覆盖。全局换品牌色时一起调整主色、hover、active、弱化、边框和背景六个值，并检查 `html.dark` 下的对应色组。

深色切换继续由 `stores/preferences.ts` 管理 `html.dark`。组件中不单独判断深色模式；文字、表面、边框和浮层阴影通过变量切换。原生的 `round`、`circle`、禁用、校验错误，以及数字输入框的按钮结构继续由 Element Plus 控制。

从顶部主题菜单切换外观时，`useThemeTransition.ts` 使用原生 View Transition 做整页昼夜渐变：新主题通过透明度平缓覆盖旧主题，不使用圆形裁剪、位移、缩放或模糊。转深色用 420ms，转浅色用 560ms，降低变亮时的突兀感。旧主题快照保持不透明，避免两层同时淡出而透出页面底色；快照期间暂停控件自身的颜色渐变。

鼠标与键盘使用相同效果。系统自动变色、实际外观未改变、浏览器不支持或启用减少动画时直接更新主题；菜单选项和本地保存逻辑保持不变。重复触发或组件销毁时清理旧过渡，避免旧动画恢复过期主题。
