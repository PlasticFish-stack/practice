<script setup lang="ts">
import { computed, onBeforeUnmount, shallowRef, useTemplateRef, watch } from 'vue';
import { ObserverError, type ObserverApi } from '@/api/xray';
import type { Action, Coverage, LogQuery, LogRecord, Node } from '@/api/xray/types';
import CoverageNotice from './CoverageNotice.vue';
import AppTable from '@/components/AppTable/AppTable.vue';
import type { ColumnOptions, TableHandle } from '@/components/AppTable/types';
import { formatTime, mergeLogs } from './format';
import { startObserverStream, type StreamState } from './stream';

const props = defineProps<{ api: ObserverApi; node: Node }>();
const mode = shallowRef('live');
const logsTable = useTemplateRef<TableHandle<LogRecord>>('logsTable');
const expandedKeys = shallowRef<string[]>([]);
const paused = shallowRef(false);
const visible = shallowRef(!document.hidden);
const action = shallowRef<Action | ''>('');
const keyword = shallowRef('');
const minutes = shallowRef(60);
const rows = shallowRef<LogRecord[]>([]);
const coverage = shallowRef<Coverage | null>(null);
const state = shallowRef<StreamState>('paused');
const error = shallowRef('');
const streamError = shallowRef('');
const busy = shallowRef(false);
const page = shallowRef(1);
const pageSize = shallowRef(50);
const total = shallowRef(0);
const updatedAt = shallowRef<number | null>(null);
let snapshot: LogQuery | null = null;
let request: AbortController | undefined;
let rateLimitedUntil = 0;
const stateLabel = computed(
  () =>
    ({
      connecting: '正在连接',
      connected: '实时连接中',
      reconnecting: '正在重连',
      paused: '已暂停',
      closed: '连接已关闭',
    })[state.value],
);
const active = computed(
  () =>
    mode.value === 'live' && !paused.value && visible.value && props.node.capabilities.access_logs,
);
function handleVisibility() {
  visible.value = !document.hidden;
}
document.addEventListener('visibilitychange', handleVisibility);
function cancelQuery() {
  request?.abort();
  busy.value = false;
}
function mergeRecent(items: LogRecord[]) {
  const cutoff = props.api.now() - 3600000;
  rows.value = mergeLogs(rows.value, items).filter((item) => item.observed_at_ms >= cutoff);
}
const pruneTimer = setInterval(() => {
  if (active.value) mergeRecent([]);
}, 30000);
async function loadLogs(live: boolean, fresh = false) {
  cancelQuery();
  if (!visible.value || !props.node.capabilities.access_logs) return;
  if (Date.now() < rateLimitedUntil) {
    error.value = '日志请求限流，请稍后重试';
    return;
  }
  const current = new AbortController();
  request = current;
  busy.value = true;
  error.value = '';
  if (fresh) {
    snapshot = null;
    page.value = 1;
    rows.value = [];
    coverage.value = null;
  }
  const to = props.api.now();
  const query: LogQuery =
    !live && snapshot
      ? { ...snapshot, page: page.value }
      : {
          node_id: props.node.node_id,
          from_ms: to - (live ? 60 : minutes.value) * 60000,
          // 先建立流再补查；实时补查采用服务端默认结束时刻，覆盖建流前的最后一秒。
          to_ms: live ? undefined : to,
          action: action.value || undefined,
          keyword: live ? undefined : keyword.value.trim() || undefined,
          sort: '-observed_at_ms',
          size: live ? 200 : pageSize.value,
          page: 1,
        };
  try {
    const result = await props.api.logs(query, current.signal);
    if (current.signal.aborted) return;
    coverage.value = result.coverage;
    if (live) {
      mergeRecent(result.items);
      // 实时视图只保留最近 300 条；固定快照补查与流事件按节点/日志 ID 去重。
      if (result.total > 200) {
        const next = await props.api.logs(
          {
            ...query,
            from_ms: result.from_ms,
            to_ms: result.to_ms,
            as_of_ms: result.as_of_ms,
            page: 2,
          },
          current.signal,
        );
        if (!current.signal.aborted) mergeRecent(next.items);
      }
    } else {
      rows.value = result.items;
      total.value = result.total;
      snapshot = {
        ...query,
        from_ms: result.from_ms,
        to_ms: result.to_ms,
        as_of_ms: result.as_of_ms,
      };
    }
    if (!current.signal.aborted) updatedAt.value = result.as_of_ms;
  } catch (cause) {
    if (!current.signal.aborted) {
      error.value = cause instanceof Error ? cause.message : '日志查询失败';
      if (cause instanceof ObserverError && cause.status === 429)
        rateLimitedUntil = Date.now() + cause.retryAfterMs;
    }
  } finally {
    if (request === current && !current.signal.aborted) busy.value = false;
  }
}
function showHistory() {
  mode.value = 'history';
}
function toggleDetails(row: LogRecord) {
  logsTable.value?.toggleRowExpansion(row);
}
function handleRowClick(row: LogRecord, _column: unknown, event: Event) {
  if (event.target instanceof Element && event.target.closest('button, .el-table__expand-icon'))
    return;
  toggleDetails(row);
}
function handleExpandChange(_row: LogRecord, expanded: LogRecord[]) {
  expandedKeys.value = expanded.map(logKey);
}
function queryHistory() {
  void loadLogs(false, true);
}
function changePage(value: { page: number; pageSize: number }) {
  page.value = value.page;
  pageSize.value = value.pageSize;
  if (snapshot) snapshot = { ...snapshot, size: value.pageSize };
  void loadLogs(false);
}
function togglePause() {
  paused.value = !paused.value;
}
watch([mode, action], () => {
  cancelQuery();
  rows.value = [];
  coverage.value = null;
  error.value = '';
  streamError.value = '';
  snapshot = null;
});
watch(
  [active, action],
  ([enabled], _old, cleanup) => {
    if (!enabled) {
      state.value = 'paused';
      cancelQuery();
      return;
    }
    let alive = true;
    const stop = startObserverStream(
      props.api,
      { node_id: props.node.node_id, events: 'log', action: action.value || undefined },
      {
        state: (value) => {
          if (alive) state.value = value;
        },
        logs: (items) => {
          if (alive) {
            mergeRecent(items);
            updatedAt.value = props.api.now();
          }
        },
        recover: () => {
          if (alive) void loadLogs(true);
        },
        error: (message) => {
          if (alive) streamError.value = message;
        },
      },
    );
    cleanup(() => {
      alive = false;
      stop();
      cancelQuery();
    });
  },
  { immediate: true },
);
watch([mode, action, visible], ([_mode, _action, value], old) => {
  if (!value) cancelQuery();
  else if (mode.value === 'history')
    void loadLogs(false, old[0] !== mode.value || old[1] !== action.value);
});
onBeforeUnmount(() => {
  clearInterval(pruneTimer);
  cancelQuery();
  document.removeEventListener('visibilitychange', handleVisibility);
});

const logColumns: ColumnOptions<LogRecord>[] = [
  { key: 'details', type: 'expand', width: 48, settingsLocked: true },
  { key: 'detail-toggle', label: '详情', width: 100, cellSelectable: false, settingsLocked: true },
  {
    key: 'time',
    label: '观测时间',
    width: 180,
    formatter: (row) => formatTime(row.observed_at_ms),
  },
  { prop: 'action', label: '动作', width: 95 },
  { prop: 'client_id', label: '客户端', minWidth: 130, showOverflowTooltip: true },
  {
    key: 'source',
    label: '来源',
    minWidth: 155,
    formatter: (row) => (row.source_ip || '—') + (row.source_masked ? '（已脱敏）' : ''),
  },
  {
    key: 'target',
    label: '目标',
    minWidth: 190,
    showOverflowTooltip: true,
    formatter: (row) =>
      (row.target_domain || row.target_ip || '—') +
      (row.target_port === null ? '' : ':' + row.target_port),
  },
  { prop: 'network', label: '网络', width: 85 },
  {
    key: 'message',
    label: '消息',
    minWidth: 220,
    showOverflowTooltip: true,
    formatter: (row) => row.message + (row.parse_status !== 'ok' ? '（解析不完整）' : ''),
  },
];
function logKey(row: LogRecord) {
  return row.node_id + ':' + row.log_id;
}
</script>

<template>
  <section
    class="panel"
    aria-labelledby="logs-title"
  >
    <div class="panel-heading">
      <div>
        <h2
          id="logs-title"
          class="panel-title"
        >
          访问日志
        </h2>
        <p class="muted">
          {{
            mode === 'live'
              ? '实时视图保留最近 1 小时内最新 300 条；重连后自动补查。更多记录请查历史。'
              : '固定时间窗与查询快照，翻页期间新日志不会挤动结果。'
          }}
        </p>
      </div>
      <el-radio-group
        v-model="mode"
        aria-label="日志模式"
      >
        <el-radio-button value="live">实时日志</el-radio-button>
        <el-radio-button value="history">历史查询</el-radio-button>
      </el-radio-group>
    </div>
    <p
      v-if="!node.capabilities.access_logs"
      class="muted"
    >
      此节点未启用访问日志采集。
    </p>
    <template v-else>
      <div class="log-tools">
        <el-select
          v-model="action"
          aria-label="日志动作"
          placeholder="全部动作"
          class="filter-select"
        >
          <el-option
            label="全部动作"
            value=""
          />
          <el-option
            label="已接受"
            value="accepted"
          />
          <el-option
            label="已拒绝"
            value="rejected"
          />
          <el-option
            label="未知"
            value="unknown"
          />
        </el-select>
        <template v-if="mode === 'history'">
          <el-select
            v-model="minutes"
            aria-label="日志时间范围"
            class="filter-select"
          >
            <el-option
              label="最近 1 小时"
              :value="60"
            />
            <el-option
              label="最近 6 小时"
              :value="360"
            />
            <el-option
              label="最近 24 小时"
              :value="1440"
            />
          </el-select>
          <el-input
            v-model="keyword"
            aria-label="日志关键字"
            placeholder="域名、来源 IP、客户端、消息"
            clearable
            class="keyword"
            @keyup.enter="queryHistory"
          />
          <el-button
            type="primary"
            :loading="busy"
            @click="queryHistory"
          >
            查询日志
          </el-button>
        </template>
        <template v-else>
          <el-tag
            :type="state === 'connected' ? 'success' : 'info'"
            role="status"
          >
            {{ stateLabel }}
          </el-tag>
          <el-button @click="togglePause">{{ paused ? '恢复实时' : '暂停实时' }}</el-button>
        </template>
      </div>
      <p
        v-if="error || streamError"
        class="error"
        role="alert"
      >
        {{ error || streamError }}
      </p>
      <CoverageNotice
        v-if="coverage"
        :coverage="coverage"
      />
      <p class="muted">
        {{ mode === 'live' ? `当前缓存 ${rows.length} 条` : `快照内共 ${total} 条` }} · 最近更新
        {{ formatTime(updatedAt) }} · 时间按浏览器本地时区显示
      </p>
      <AppTable
        ref="logsTable"
        table-key="observe.logs"
        :rows="rows"
        :column-options="logColumns"
        :loading="busy"
        :table-options="{ rowKey: logKey, maxHeight: 480, stripe: true }"
        :pagination="
          mode === 'history' ? { page, pageSize, total: Math.min(total, 100000) } : undefined
        "
        title="访问记录"
        class="logs-table"
        @page-change="changePage"
        @row-click="handleRowClick"
        @expand-change="handleExpandChange"
      >
        <template #empty>
          <div class="logs-empty">
            <span>暂无采集记录，请结合覆盖范围判断</span>
            <el-button
              v-if="mode === 'live'"
              type="primary"
              plain
              @click="showHistory"
            >
              查历史
            </el-button>
          </div>
        </template>
        <template #cell-detail-toggle="{ row }">
          <el-button
            link
            type="primary"
            :aria-expanded="expandedKeys.includes(logKey(row))"
            @click.stop="toggleDetails(row)"
          >
            {{ expandedKeys.includes(logKey(row)) ? '收起详情' : '展开详情' }}
          </el-button>
        </template>
        <template #cell-details="{ row }">
          <div
            class="log-details"
            @click.stop
          >
            <dl class="log-detail-fields">
              <dt>消息</dt>
              <dd class="log-message">{{ row.message }}</dd>
              <dt>日志 ID</dt>
              <dd>{{ row.log_id }}</dd>
              <dt>节点 ID</dt>
              <dd>{{ row.node_id }}</dd>
              <dt>入站 ID</dt>
              <dd>{{ row.inbound_id ?? '—' }}</dd>
              <dt>客户端 ID</dt>
              <dd>{{ row.client_id ?? '—' }}</dd>
              <dt>观察时间</dt>
              <dd>{{ row.observed_at }} ({{ row.observed_at_ms }})</dd>
              <dt>接收时间</dt>
              <dd>{{ row.received_at }} ({{ row.received_at_ms }})</dd>
              <dt>来源 IP / 端口</dt>
              <dd>
                {{ row.source_ip ?? '—' }} / {{ row.source_port ?? '—'
                }}{{ row.source_masked ? '（已脱敏）' : '' }}
              </dd>
              <dt>目标域名</dt>
              <dd>{{ row.target_domain ?? '—' }}</dd>
              <dt>目标 IP / 端口</dt>
              <dd>{{ row.target_ip ?? '—' }} / {{ row.target_port ?? '—' }}</dd>
              <dt>网络</dt>
              <dd>{{ row.network }}</dd>
              <dt>outbound</dt>
              <dd>{{ row.outbound_tag ?? '—' }}</dd>
              <dt>解析状态</dt>
              <dd>{{ row.parse_status }}</dd>
            </dl>
          </div>
        </template>
        <template #cell-action="{ row }">
          <el-tag
            :type="
              row.action === 'accepted' ? 'success' : row.action === 'rejected' ? 'danger' : 'info'
            "
            size="small"
          >
            {{
              row.action === 'accepted' ? '已接受' : row.action === 'rejected' ? '已拒绝' : '未知'
            }}
          </el-tag>
        </template>
      </AppTable>
      <p
        v-if="mode === 'history' && total > 100000"
        class="muted"
      >
        结果超过可翻页上限，请缩小时间范围或增加过滤条件。
      </p>
    </template>
  </section>
</template>

<style scoped>
.panel {
  min-width: 0;
}
.panel-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}
.panel-title {
  margin: 0;
  font-size: 17px;
}
.muted {
  color: var(--app-color-text-secondary);
  font-size: 12px;
}
.log-tools {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  margin: 16px 0;
}
.filter-select {
  width: 140px;
}
.log-tools :deep(.el-tag) {
  flex-shrink: 0;
}
.keyword {
  width: 260px;
}
.logs-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: 12px;
  padding: 12px;
}
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
.logs-table {
  width: 100%;
}
.pagination {
  margin-top: 16px;
  justify-content: flex-end;
}
.error {
  color: var(--el-color-danger);
}
@media (max-width: 680px) {
  .keyword {
    width: 100%;
  }
}
</style>
