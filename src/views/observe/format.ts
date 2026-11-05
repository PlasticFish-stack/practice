import type { Coverage, LogRecord, RangeQuery } from '@/api/xray/types';

export function formatBytes(value: string | null | undefined): string {
  if (value == null || !/^\d+$/.test(value)) return '—';
  const bytes = BigInt(value);
  const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB'];
  let divisor = 1n;
  let unit = 0;
  while (bytes >= divisor * 1024n && unit < units.length - 1) {
    divisor *= 1024n;
    unit++;
  }
  return `${bytes / divisor}${unit ? `.${((bytes % divisor) * 10n) / divisor}` : ''} ${units[unit]}`;
}
export function byteRatio(used: string | null | undefined, total: string | null | undefined) {
  if (
    used == null ||
    total == null ||
    !/^\d+$/.test(used) ||
    !/^\d+$/.test(total) ||
    BigInt(total) === 0n
  )
    return null;
  return Number((BigInt(used) * 10000n) / BigInt(total)) / 100;
}
export function percent(value: number | null | undefined) {
  return value == null ? '—' : `${value.toFixed(1)}%`;
}
export function formatTime(ms: number | null | undefined) {
  return ms == null ? '—' : new Date(ms).toLocaleString('zh-CN', { hour12: false });
}
export function formatRate(value: number | null | undefined) {
  return value == null
    ? '—'
    : `${formatBytes(BigInt(Math.max(0, Math.round(value))).toString())}/s`;
}
export function metricRange(now: number, minutes = 60): RangeQuery {
  const to_ms = Math.floor(now / 60000) * 60000;
  return { from_ms: to_ms - minutes * 60000, to_ms, step: '1m' };
}
const reasons: Record<string, string> = {
  collector_gap: '采集起点之前无数据',
  retention: '历史已按保留策略清理',
  storage_limit: '存储上限导致缺口',
  parse_failure: '部分日志解析失败',
};
export function coverageText(coverage: Coverage) {
  return coverage.partial
    ? `部分覆盖：${coverage.reasons.map((reason) => reasons[reason] || reason).join('、') || '数据不完整'}。可用区间 ${formatTime(coverage.available_from_ms)} — ${formatTime(coverage.available_to_ms)}`
    : '查询窗口覆盖完整';
}
export function mergeLogs(current: LogRecord[], incoming: LogRecord[], limit = 300) {
  const records = new Map(current.map((item) => [`${item.node_id}:${item.log_id}`, item]));
  for (const item of incoming) records.set(`${item.node_id}:${item.log_id}`, item);
  return [...records.values()]
    .sort(
      (a, b) =>
        b.observed_at_ms - a.observed_at_ms ||
        b.received_at_ms - a.received_at_ms ||
        (a.log_id < b.log_id ? -1 : a.log_id > b.log_id ? 1 : 0),
    )
    .slice(0, limit);
}
