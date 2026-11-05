# Web 终端

入口为「开发演示 → 终端演示」，地址 `/playground/terminal`，沿用 `playground:read` 演示权限。使用 [xterm.js](https://xtermjs.org/) 和官方 FitAddon，按路由懒加载。

当前提供可操作的本地演示和 WebSocket 适配，仓库没有 SSH 后端或 VPS 数据源。本地命令和资源数值为示例数据，不执行本机或 VPS 的系统命令。

## 复用组件

`components/AppTerminal/AppTerminal.vue` 只管理显示、键盘输入、尺寸、选择和生命周期，不创建连接、不添加本地回显、不解析业务命令。

```vue
<script setup lang="ts">
import AppTerminal from '@/components/AppTerminal/AppTerminal.vue';
import type { TerminalHandle } from '@/components/AppTerminal/types';
import { onDeactivated } from 'vue';
import { useTerminalConnection } from '@/composables/useTerminalConnection';

let terminal: TerminalHandle | undefined;
const connection = useTerminalConnection((data, parsed) => {
  if (terminal) terminal.write(data, parsed);
  else parsed();
});
function ready(api: TerminalHandle) {
  terminal = api;
}
function connect() {
  if (terminal) connection.connect('/api/vps/hosts/my-host/terminal', terminal.getSize());
}
onDeactivated(connection.disconnect);
</script>

<template>
  <button
    type="button"
    @click="connect"
  >
    连接已部署的网关
  </button>
  <p v-if="connection.error.value">{{ connection.error.value }}</p>
  <AppTerminal
    title="服务器终端"
    :status="connection.status.value"
    @ready="ready"
    @data="connection.input"
    @binary="connection.binary"
    @resize="connection.resize"
  />
</template>
```

- Props：`title`、`subtitle`、`status`、`statusLabel`、`readOnly`、`dark`、`height`、`fontSize`、`scrollback`。默认高度 440px、字号 14px、滚屏 2000 行；字号限制 10–24，滚屏最多 10000 行。
- `data`：原始键盘/粘贴字符串，保留回车、ANSI、Ctrl+C 等；只有已连接且非只读时发出。不要改成按行提交，否则交互式程序无法工作。
- `binary`：鼠标等非 UTF-8 输入的原始字节，需要的适配器应单独转发。
- `resize`：`{ cols, rows }`，容器、字号和全屏变化后自动适配。隐藏页签不按零宽拟合，重新激活后恢复。
- `ready`：传出 `TerminalHandle`。也可通过模板 ref 使用 `write(data, parsed?)`、`writeln()`、`clear()`、`reset()`、`focus()`、`fit()`、`getSize()`、`getSelection()`、`getBuffer()`。
- `write()` 支持字符串或 `Uint8Array`，解析完成时调用 `parsed`，可用于输出流控。初始化前应等待 `ready`。
- “清屏”调用 `clear()` 清除滚屏；新会话使用 `reset()`。复制只读取选中内容，失败明确提示。
- 工具栏清屏后发出 `clear` 事件，本地演示据此恢复尚未提交的输入。`getBuffer()` 提供只读光标、换行与单元格状态；应在 `write()` 的解析回调之后读取。
- 默认深色，也可传 `:dark="preferences.dark"` 跟随项目主题。不会根据输出修改网页标题、执行 HTML 或自动打开链接。

KeepAlive 停用时暂停输入、观察器和焦点，销毁时释放 xterm、事件和插件。演示页保留本地会话；远端网关离开页签时主动断开，返回后需手动连接。

本地演示的行编辑位于 `views/playground/demoLineEditor.ts`：不设原来的 256 字符截断，按解析顺序处理输入，退格依据终端实际单元格宽度和换行状态删除；字号、窗口变化后恢复当前输入。它不是完整 Shell，真实网关输入仍原样交给后端 PTY，不经过本地命令或行编辑逻辑。

本地演示不支持 `cat`、文件重定向或 `<<EOF` heredoc。粘贴这类脚本会逐行返回“未提供此演示命令”，不能用它验证真实 Shell 的脚本执行。多行粘贴转发已通过模拟 WebSocket 网关验证，覆盖中文、空行、缩进、长行、引号、变量原文及远端启用 bracketed paste 的情况；真实 heredoc 执行仍需接入 SSH/PTY 后验证。

## 网关协议

本地演示支持输入高亮：可用命令绿色、未知命令红色、选项青色、引号字符串黄色，普通参数使用默认文字色。颜色通过 ANSI 输出，编辑和历史重绘时同步更新；此功能只负责展示，不解释 Shell 语法。网关模式保留远端 Shell 的原始颜色。

通用适配器位于 `composables/useTerminalConnection.ts`。只接受同源地址，HTTP 页面转换为 WS，HTTPS 使用 WSS，拒绝外部主机和 URL 中的用户名/密码，不保存地址或凭据。不应记录原始键盘输入，它可能包含交互式程序中的密码。

客户端文本帧：

```json
{ "type": "input", "data": "ls\r" }
{ "type": "resize", "cols": 120, "rows": 30 }
```

客户端二进制帧为原始 PTY 输入字节。网关完成 SSH/PTY 初始化后才发送 `ready`，仅 WebSocket 打开不代表 SSH 已连接：

```json
{ "type": "ready" }
{ "type": "output", "data": "\u001b[32mhello\u001b[0m\r\n" }
{ "type": "error", "message": "没有该主机的终端访问权限" }
{ "type": "exit" }
```

服务端也可直接发送二进制输出，交给 xterm 增量解码 UTF-8。初始化超时 10 秒；不自动重连、不缓存或补发输入。发送缓冲超过 256KiB 或尚未解析输出超过 1MiB 时停止连接，避免无限堆积；后端仍须实现 PTY 流控。

## 接真实 VPS

后端按主机 ID 校验会话及主机访问权限，再创建 SSH 会话和 PTY，转发输入、输出与窗口尺寸，断开时释放资源。生产终端应配置独立权限，不复用演示权限。

浏览器不直接持有 SSH 私钥或密码。网关需要握手 Origin 校验、会话与终端授权、主机密钥验证、审计、过期处理和资源限制。这些属于后端能力，参考 [xterm.js 安全指南](https://xtermjs.org/docs/guides/security/)。
