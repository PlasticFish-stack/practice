# SSE 使用与选型

当前实现：`src/composables/useSSE.ts`，使用原生 Fetch 读取流，使用 `eventsource-parser` 解析 SSE 协议。

## 为什么选这个方案

| 方案                                   | 适合的情况                                       | 限制                                                                               |
| -------------------------------------- | ------------------------------------------------ | ---------------------------------------------------------------------------------- |
| 原生 EventSource                       | GET 订阅、Cookie 鉴权，希望浏览器管理重连        | 构造参数只有 URL 和 withCredentials，不能直接设置 Authorization 请求头或 POST body |
| Fetch + eventsource-parser（当前方案） | Bearer Token、自定义请求头、POST 流式响应        | 面向支持 Fetch 流式读取的现代浏览器，需要自己管理连接生命周期                      |
| @microsoft/fetch-event-source          | 希望由完整客户端库管理读取、重连、页面可见性行为 | 需要理解并配置它的重连和页面隐藏策略                                               |

原生 EventSource 已在现代主流浏览器中广泛支持。选择 Fetch 是为了请求控制能力，并不意味着它兼容更多旧浏览器。项目目前没有指定 WebView/旧浏览器版本，不能据此承诺这些环境可用。

当前应用采用同源 HttpOnly Cookie 会话；Fetch 默认携带同源 Cookie，不再自动读取 localStorage Token。需要 Bearer 时显式提供 headers（也可传函数，每次重连重新取值）。SSE 不经过 Axios，onError 中的 401 应由调用方按业务处理。POST 同源请求会携带可读 XSRF-TOKEN 对应的 X-XSRF-TOKEN 头；该 Cookie 需先由会话/CSRF 接口建立。

不要自行用 `chunk.split('\n\n')` 解析流：网络分块可能截断 UTF-8 字符、行或整个事件。解析库负责多行 data、注释、CR/LF、event、id、retry；TextDecoder 负责跨字节分块解码。

## GET 订阅

以下地址是接入示例，项目尚无对应后端 SSE 接口。

```vue
<script setup lang="ts">
import { onMounted } from 'vue';
import { useSSE } from '@/composables/useSSE';

const { connect, close, status, error, lastEvent } = useSSE('/api/devices/events', {
  onMessage(message) {
    // 所有事件都会到这里，包含自定义 event；data 保持字符串。
    if (message.event === 'device') {
      const device = JSON.parse(message.data);
      console.log(device);
    }
  },
  onError(error) {
    console.error(error);
  },
});

onMounted(connect);
// 在 setup 的作用域内创建时，销毁组件会自动 close()。
</script>

<template>
  <p>{{ status }}</p>
  <p v-if="error">{{ error.message }}</p>
  <pre>{{ lastEvent?.data }}</pre>
  <button @click="connect">连接</button>
  <button @click="close">关闭</button>
</template>
```

## POST 流式响应

```ts
const { connect, close } = useSSE('/api/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ prompt: '你好' }),
  onMessage(message) {
    // [DONE] 是部分服务的业务约定，不是 SSE 协议。
    if (message.data === '[DONE]') close();
    else console.log(message.data);
  },
});
connect();
```

POST 默认不自动重连，正常 EOF 直接结束；网络异常通过 error / onError 暴露。显式 retry: true 前，需要确保请求体可重复发送，并由后端保证重复执行安全。

## 连接规则

- connect() 手动开始；重复调用不会建立第二条活动连接。
- GET 默认自动重连，每次 connect() 总共最多重试 3 次，不会因短暂连上就无限重置次数。
- 默认重连间隔为 3 秒，指数递增，最多 30 秒；服务端 retry 字段更新基础间隔。
- 204 正常停止；401/403/404 和错误 Content-Type 停止；网络错误、408、429、5xx 可以重试。
- close() 取消当前请求和重连等待。再次 connect() 保留事件游标以尝试恢复。
- 自动发送 Last-Event-ID，但补发、去重和恢复能力需要后端实现，不能保证消息不丢失。
- onMessage 回调异常会记录到 console，不触发重连，避免重复执行业务逻辑。
- 仅保存最后一条消息，不累积全部历史；未完成事件的解析缓冲上限为 1 MiB。
- SSE 是单向推送，保活注释由服务端发送；这里没有额外的静默超时策略。
- 跨域 Authorization/Cookie 依赖服务端正确配置 CORS；Fetch 不能绕过代理缓冲或 HTTP 连接限制。

## 验证

```sh
node --test tests/sse.test.cjs tests/http.test.cjs
```

SSE 测试包含模拟分块、作用域销毁和本地 HTTP 实际流式连接。没有验证生产后端、代理或真实浏览器版本。

参考：[MDN EventSource](https://developer.mozilla.org/en-US/docs/Web/API/EventSource)、[EventSource 构造参数](https://developer.mozilla.org/en-US/docs/Web/API/EventSource/EventSource)、[Fetch 流式处理](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch)、[eventsource-parser](https://github.com/rexxars/eventsource-parser)、[fetch-event-source](https://github.com/Azure/fetch-event-source)。
