# Web 终端

基础版保留通用终端组件和网关适配器，不提供默认演示路由。使用 [xterm.js](https://xtermjs.org/) 和官方 FitAddon，由业务页面按需导入。

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

## 网关协议

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

后端按主机 ID 校验会话及主机访问权限，再创建 SSH 会话和 PTY，转发输入、输出与窗口尺寸，断开时释放资源。生产终端应配置独立权限。

浏览器不直接持有 SSH 私钥或密码。网关需要握手 Origin 校验、会话与终端授权、主机密钥验证、审计、过期处理和资源限制。这些属于后端能力，参考 [xterm.js 安全指南](https://xtermjs.org/docs/guides/security/)。
