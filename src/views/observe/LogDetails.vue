<script setup lang="ts">
import type { LogRecord } from '@/api/xray/types';
defineProps<{ id: string; record: LogRecord }>();
</script>

<template>
  <section
    :id="id"
    class="log-details"
    role="region"
    :aria-label="`日志详情 ${record.log_id}`"
    @click.stop
  >
    <dl class="log-detail-fields">
      <dt>消息</dt>
      <dd class="log-message">{{ record.message }}</dd>
      <dt>日志 ID</dt>
      <dd>{{ record.log_id }}</dd>
      <dt>节点 ID</dt>
      <dd>{{ record.node_id }}</dd>
      <dt>入站 ID</dt>
      <dd>{{ record.inbound_id ?? '—' }}</dd>
      <dt>客户端 ID</dt>
      <dd>{{ record.client_id ?? '—' }}</dd>
      <dt>观察时间</dt>
      <dd>{{ record.observed_at }} ({{ record.observed_at_ms }})</dd>
      <dt>接收时间</dt>
      <dd>{{ record.received_at }} ({{ record.received_at_ms }})</dd>
      <dt>来源 IP / 端口</dt>
      <dd>
        {{ record.source_ip ?? '—' }} / {{ record.source_port ?? '—'
        }}{{ record.source_masked ? '（已脱敏）' : '' }}
      </dd>
      <dt>目标域名</dt>
      <dd>{{ record.target_domain ?? '—' }}</dd>
      <dt>目标 IP / 端口</dt>
      <dd>{{ record.target_ip ?? '—' }} / {{ record.target_port ?? '—' }}</dd>
      <dt>网络</dt>
      <dd>{{ record.network }}</dd>
      <dt>outbound</dt>
      <dd>{{ record.outbound_tag ?? '—' }}</dd>
      <dt>解析状态</dt>
      <dd>{{ record.parse_status }}</dd>
    </dl>
  </section>
</template>

<style scoped>
.log-details {
  width: min(900px, calc(100vw - 100px));
  padding: 16px;
  box-sizing: border-box;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  user-select: text;
}
.log-detail-fields {
  display: grid;
  grid-template-columns: minmax(0, 110px) minmax(0, 1fr);
  gap: 10px;
  margin: 0;
}
.log-detail-fields dt {
  color: var(--app-color-text-secondary);
}
.log-detail-fields dd {
  min-width: 0;
  margin: 0;
}
@media (max-width: 480px) {
  .log-detail-fields {
    grid-template-columns: minmax(0, 1fr);
    gap: 4px;
  }
  .log-detail-fields dd {
    margin-bottom: 8px;
  }
}
</style>
