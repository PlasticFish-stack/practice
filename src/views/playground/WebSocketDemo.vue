<script setup lang="ts">
import { onDeactivated, shallowRef } from 'vue';
import { useWebSocket } from '@/composables/useWebSocket';

const message = shallowRef('testh');
const received = shallowRef('');
const status = shallowRef('未连接');
const { connect, close, sendMessage, addEventListener } = useWebSocket('wss://echo.websocket.org');

addEventListener('open', () => {
  status.value = '已连接';
});
addEventListener('message', (event) => {
  received.value = String(event.data);
});
addEventListener('close', () => {
  status.value = '连接已断开';
});
addEventListener('error', () => {
  status.value = '连接异常';
});

function disconnect() {
  close();
  status.value = '已关闭';
}
onDeactivated(() => {
  close();
  status.value = '连接已暂停';
});
</script>

<template>
  <section>
    <h2>WebSocket 演示</h2>
    <p>{{ status }}</p>
    <el-input
      v-model="message"
      placeholder="输入测试消息"
    />
    <el-button @click="connect">连接</el-button>
    <el-button @click="sendMessage(message)">发送</el-button>
    <el-button @click="disconnect">关闭</el-button>
    <pre>{{ received }}</pre>
  </section>
</template>
