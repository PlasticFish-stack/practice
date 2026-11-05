/** Xray observer API v1.0.1. Synced from the shared integration contract. */
export type DecimalBytes = string; // /^(0|[1-9][0-9]*)$/; never a JSON number.
export type Step = '1m' | '5m' | '1h';
export type TrafficSource = 'xui_db' | 'xray_stats';
export type Action = 'accepted' | 'rejected' | 'unknown';
export interface Timestamp {
  observed_at: string; // RFC3339, UTC Z; same instant as observed_at_ms.
  observed_at_ms: number; // Unix milliseconds, integer.
}
export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    detail: Record<string, unknown>;
    request_id: string;
  };
}
export interface PageQuery {
  page?: number;
  size?: number;
  sort?: string;
}
export interface Page<T> {
  items: T[];
  page: number;
  size: number;
  total: number;
}
export interface RangeQuery {
  from_ms: number;
  to_ms: number;
  step: Step;
}
export interface Coverage {
  available_from_ms: number | null;
  available_to_ms: number | null;
  partial: boolean;
  reasons: string[];
}
export interface SeriesRange extends RangeQuery {
  bucket_anchor_ms: 0;
  coverage: Coverage;
}
export interface Session {
  subject: string;
  permissions: ('observe:read' | 'observe:write')[];
  api_version: '1.0.1';
  data_mode: 'mock' | 'live'; // Same service-level constant as X-Data-Mode on every response.
  token_expires_at: string | null;
  token_expires_at_ms: number | null;
  features: { alerts: boolean; multi_node: boolean };
}
export interface Node {
  node_id: string;
  name: string;
  status: 'online' | 'offline' | 'unknown';
  xray_running: boolean | null;
  uptime_seconds: number | null; // Host uptime, not Xray or collector uptime.
  versions: { collector: string | null; xui: string | null; xray: string | null };
  last_seen_at: string | null;
  last_seen_at_ms: number | null;
  capabilities: {
    access_logs: boolean;
    host_metrics: boolean;
    traffic_source: TrafficSource | 'unavailable';
  };
}
export interface Overview extends Timestamp {
  panel_version: string;
  panel_uptime_seconds: number;
  nodes_total: number;
  nodes_online: number;
  inbounds_total: number;
  clients_total: number;
  active_clients_5m: number | null; // Sum of distinct (node_id, client_id); not cross-node unique users.
  partial: boolean;
  node_errors: { node_id: string; code: string; message: string }[];
}
export interface TrafficCounter extends Timestamp {
  source: TrafficSource;
  counter_epoch: string; // Changes on reset, source switch, or unprovable continuity.
  up_bytes: DecimalBytes; // Client -> proxy -> destination.
  down_bytes: DecimalBytes; // Destination -> proxy -> client.
  total_bytes: DecimalBytes;
  stale: boolean; // server_now_ms - observed_at_ms > 30000; equality is not stale.
}
export interface Inbound {
  node_id: string;
  inbound_id: string;
  tag: string;
  remark: string | null;
  protocol: string;
  listen: string | null;
  port: number | null;
  enabled: boolean; // Must be available in a successfully returned Inbound.
  client_count: number;
  traffic: TrafficCounter | null;
}
export interface Client {
  node_id: string;
  inbound_id: string;
  client_id: string;
  label: string | null;
  enabled: boolean | null; // Source may not expose a client-specific switch; null is not false.
  expires_at: string | null;
  expires_at_ms: number | null;
  quota_bytes: DecimalBytes | null; // null = unlimited/unknown; "0" is a real zero quota.
  last_seen_at: string | null;
  last_seen_at_ms: number | null;
  active_recent: boolean | null;
  traffic: TrafficCounter | null;
}
export interface HostMetric extends Timestamp {
  cpu_usage_ratio: number | null;
  memory_used_bytes: DecimalBytes | null;
  memory_total_bytes: DecimalBytes | null;
  disk_used_bytes: DecimalBytes | null;
  disk_total_bytes: DecimalBytes | null;
  network_rx_bytes_per_sec: number | null;
  network_tx_bytes_per_sec: number | null;
  sample_count: number;
}
export interface HostSeries {
  node_id: string;
  range: SeriesRange;
  points: HostMetric[];
}
export interface TrafficPoint extends Timestamp {
  up_bytes: DecimalBytes | null; // Delta within this bucket, not the cumulative counter.
  down_bytes: DecimalBytes | null;
  up_bytes_per_sec: number | null;
  down_bytes_per_sec: number | null;
  sample_count: number;
}
export interface ClientTraffic {
  node_id: string;
  client_id: string;
  current: TrafficCounter | null;
  range: SeriesRange;
  points: TrafficPoint[];
}
export interface LogRecord extends Timestamp {
  log_id: string; // Immutable, unique within node_id; no time or numeric ordering guarantee.
  node_id: string;
  inbound_id: string | null;
  client_id: string | null;
  received_at: string;
  received_at_ms: number; // First central ingestion time; unchanged on duplicate/replay.
  action: Action;
  network: 'tcp' | 'udp' | 'unknown';
  source_ip: string | null; // Privacy-normalized CIDR or IP, as declared in source_masked.
  source_port: number | null;
  source_masked: boolean;
  target_domain: string | null;
  target_ip: string | null;
  target_port: number | null;
  outbound_tag: string | null;
  message: string; // Redacted, <= 1024 UTF-8 bytes; never unfiltered raw credentials.
  parse_status: 'ok' | 'partial' | 'failed';
}
export interface LogQuery extends PageQuery {
  sort?: 'observed_at_ms' | '-observed_at_ms';
  node_id: string;
  from_ms?: number;
  to_ms?: number;
  as_of_ms?: number;
  client_id?: string;
  inbound_id?: string;
  source_ip?: string;
  keyword?: string;
  action?: Action;
}
export interface LogPage extends Page<LogRecord> {
  from_ms: number;
  to_ms: number;
  as_of_ms: number;
  coverage: Coverage;
}
export interface StatsQuery extends RangeQuery {
  node_id: string;
  group_by: 'target' | 'source_ip' | 'action';
  top?: number;
  client_id?: string;
  action?: Action;
}
export interface Stats {
  node_id: string;
  group_by: StatsQuery['group_by'];
  range: SeriesRange;
  total: number; // Exactly sum(buckets[].total), including when coverage is partial.
  top: { key: string; count: number }[];
  buckets: (Timestamp & { accepted: number; rejected: number; unknown: number; total: number })[];
}
export interface StreamQuery {
  node_id: string;
  events?: string; // Comma-separated unique subset of log,metric,alert; default log,metric.
  client_id?: string; // Applies to log events only.
  action?: Action; // Applies to log events only.
}
export interface AlertRuleInput {
  node_id: string;
  name: string;
  metric: 'cpu_usage_ratio' | 'memory_used_ratio' | 'disk_used_ratio' | 'node_offline';
  operator: 'gte';
  threshold: number;
  duration_seconds: number;
  enabled: boolean;
}
export interface AlertRule extends AlertRuleInput {
  rule_id: string;
  version: number;
}
export interface Alert {
  alert_id: string;
  rule_id: string;
  node_id: string;
  state: 'firing' | 'resolved';
  message: string;
  value: number | null;
  triggered_at: string;
  triggered_at_ms: number;
  resolved_at: string | null;
  resolved_at_ms: number | null;
}
export interface StreamEvents {
  log: { items: LogRecord[] };
  metric: { node_id: string; sample: HostMetric };
  alert: { item: Alert };
  ping: Timestamp;
}
