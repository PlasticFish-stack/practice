import { expect, test, type Page, type Route } from '@playwright/test';
import type { Client, LogRecord } from '../../src/api/xray/types';

const now = Date.now();
const time = { observed_at: new Date(now).toISOString(), observed_at_ms: now };
const coverage = {
  available_from_ms: now - 60000,
  available_to_ms: now,
  partial: true,
  reasons: ['collector_gap'],
};
const counter = {
  ...time,
  source: 'xui_db',
  counter_epoch: 'boot-test:2',
  up_bytes: '9007199254740993',
  down_bytes: '0',
  total_bytes: '9007199254740993',
  stale: false,
};
const node = {
  node_id: 'node-01',
  name: '联调节点',
  status: 'online',
  xray_running: null,
  uptime_seconds: 90,
  versions: { collector: 'test', xui: null, xray: null },
  last_seen_at: time.observed_at,
  last_seen_at_ms: now,
  capabilities: { access_logs: true, host_metrics: true, traffic_source: 'xui_db' },
};
const client = {
  node_id: node.node_id,
  inbound_id: '1',
  client_id: 'client-01',
  label: '测试客户端',
  enabled: null,
  active_recent: null,
  expires_at: null,
  expires_at_ms: null,
  quota_bytes: '0',
  last_seen_at: null,
  last_seen_at_ms: null,
  traffic: counter,
};
function log(id = 'log-1'): LogRecord {
  return {
    ...time,
    log_id: id,
    node_id: node.node_id,
    inbound_id: '1',
    client_id: client.client_id,
    received_at: time.observed_at,
    received_at_ms: now,
    action: 'accepted',
    network: 'tcp',
    source_ip: '192.0.2.0/24',
    source_port: null,
    source_masked: true,
    target_domain: 'example.test',
    target_ip: null,
    target_port: 443,
    outbound_tag: 'direct',
    message: '<img src=x onerror=alert(1)>',
    parse_status: 'ok',
  };
}
async function json(route: Route, body: unknown, status = 200, headers = {}) {
  await route.fulfill({
    status,
    contentType: 'application/json',
    headers: { 'X-Server-Time-Ms': String(now), ...headers },
    body: JSON.stringify(body),
  });
}
type FixtureOptions = {
  history?: boolean;
  emptyLogs?: boolean;
  logs?: LogRecord[];
  clients?: Client[];
  stream?: (route: Route, count: number) => Promise<void>;
};
async function fixture(page: Page, options: FixtureOptions = {}) {
  let streams = 0;
  const requests: {
    path: string;
    params: URLSearchParams;
    auth: string | undefined;
    cursor: string | undefined;
  }[] = [];
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url());
    requests.push({
      path: url.pathname,
      params: url.searchParams,
      auth: route.request().headers().authorization,
      cursor: route.request().headers()['last-event-id'],
    });
    const path = url.pathname.replace('/api/v1', '');
    if (route.request().headers().authorization !== 'Bearer test-observer-token')
      return json(
        route,
        { error: { message: '令牌无效', code: 'invalid_token', detail: {}, request_id: 'test' } },
        401,
      );
    if (path === '/auth/session')
      return json(route, {
        subject: 'observer',
        permissions: ['observe:read'],
        api_version: '1.0.1',
        data_mode: 'mock',
        token_expires_at: null,
        token_expires_at_ms: null,
        features: { alerts: false, multi_node: true },
      });
    if (path === '/overview')
      return json(route, {
        ...time,
        panel_version: 'test',
        panel_uptime_seconds: 90,
        nodes_total: 1,
        nodes_online: 1,
        inbounds_total: 1,
        clients_total: 1,
        active_clients_5m: null,
        partial: false,
        node_errors: [],
      });
    if (path === '/nodes') return json(route, { items: [node], page: 1, size: 200, total: 1 });
    if (path === '/inbounds')
      return json(route, {
        items: [
          {
            node_id: node.node_id,
            inbound_id: '1',
            tag: '测试入站',
            remark: null,
            protocol: 'vless',
            listen: null,
            port: 8443,
            enabled: true,
            client_count: 1,
            traffic: counter,
          },
        ],
        page: 1,
        size: 20,
        total: 1,
      });
    if (path === '/clients')
      return json(route, {
        items: options.clients ?? [client],
        page: 1,
        size: 20,
        total: options.clients?.length ?? 1,
      });
    const range = {
      from_ms: Number(url.searchParams.get('from_ms')),
      to_ms: Number(url.searchParams.get('to_ms')),
      step: '1m',
      bucket_anchor_ms: 0,
      coverage,
    };
    if (path === '/host/metrics')
      return json(route, {
        node_id: node.node_id,
        range,
        points: [
          {
            ...time,
            observed_at_ms: range.to_ms - 60000,
            cpu_usage_ratio: 0,
            memory_used_bytes: '0',
            memory_total_bytes: '1024',
            disk_used_bytes: null,
            disk_total_bytes: null,
            network_rx_bytes_per_sec: 0,
            network_tx_bytes_per_sec: null,
            sample_count: 2,
          },
        ],
      });
    if (path.endsWith('/traffic'))
      return json(route, {
        node_id: node.node_id,
        client_id: client.client_id,
        current: counter,
        range,
        points: [
          {
            ...time,
            sample_count: 0,
            up_bytes: null,
            down_bytes: null,
            up_bytes_per_sec: null,
            down_bytes_per_sec: null,
          },
        ],
      });
    if (path === '/logs') {
      const pageNumber = Number(url.searchParams.get('page') || 1);
      return json(route, {
        items: options.emptyLogs
          ? []
          : (options.logs ?? (options.history ? [log(`page-${pageNumber}`)] : [log()])),
        page: pageNumber,
        size: Number(url.searchParams.get('size')),
        total: options.emptyLogs ? 0 : options.history ? 60 : 1,
        from_ms: Number(url.searchParams.get('from_ms') || now - 3600000),
        to_ms: Number(url.searchParams.get('to_ms') || now),
        as_of_ms: Number(url.searchParams.get('as_of_ms') || now),
        coverage,
      });
    }
    if (path === '/stream') {
      streams++;
      if (options.stream) return options.stream(route, streams);
      return route.fulfill({
        contentType: 'text/event-stream',
        body: `retry: 10000\n\nevent: ping\nid: opaque-cursor\ndata: ${JSON.stringify(time)}\n\n`,
      });
    }
    return json(route, { error: { code: 'not_found', message: '无此资源' } }, 404);
  });
  return requests;
}
async function connect(page: Page, token = 'test-observer-token') {
  await page.goto('/observe');
  await page.getByLabel('访问令牌', { exact: true }).fill(token);
  await page.getByRole('button', { name: '连接观察服务' }).click();
}
test('独立鉴权、未知状态、零值、覆盖提示和失效清理', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const oldApi: string[] = [];
  page.on('request', (request) => {
    if (/\/api\/(auth|system)\//.test(request.url())) oldApi.push(request.url());
  });
  const requests = await fixture(page);
  await connect(page, 'wrong-token');
  await expect(page.getByRole('alert')).toContainText('令牌已失效');
  await page.getByLabel('访问令牌', { exact: true }).fill('test-observer-token');
  await page.getByRole('button', { name: '连接观察服务' }).click();
  await expect(page.getByRole('heading', { name: '运行概览' })).toBeVisible();
  await expect(page.getByRole('img', { name: '鲸栈' })).toBeVisible();
  await expect(page.getByRole('menuitem', { name: 'Xray 观察面板', exact: true })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Xray 观察面板', exact: true })).toBeVisible();
  await expect(page.getByText('Xray：未探测')).toBeVisible();
  await expect(page.getByText(/部分覆盖/).first()).toBeVisible();
  await expect(page.getByText('0.0%', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('cell', { name: '0 B', exact: true })).toBeVisible();
  await expect(page.getByRole('cell', { name: '8.0 PiB / 0 B', exact: true })).toBeVisible();
  await expect(page.locator('.logs-table img')).toHaveCount(0);
  await page.getByRole('button', { name: '查看曲线' }).click();
  await expect(page.getByText('暂无有效速率，等待至少两个连续采样点')).toBeVisible();
  const stored = await page.evaluate(() =>
    JSON.stringify({ local: { ...localStorage }, session: { ...sessionStorage } }),
  );
  expect(stored).not.toContain('test-observer-token');
  expect(oldApi).toEqual([]);
  expect(
    requests
      .filter((request) => request.path.endsWith('/host/metrics'))
      .every(
        (request) =>
          Number(request.params.get('from_ms')) % 60000 === 0 &&
          Number(request.params.get('to_ms')) % 60000 === 0,
      ),
  ).toBe(true);
  await page.route('**/api/v1/overview', (route) =>
    json(route, { error: { code: 'invalid_token', message: '令牌失效' } }, 401),
  );
  await page.getByRole('button', { name: '刷新概览' }).click();
  await expect(page.getByRole('heading', { name: '连接你的观察节点' })).toBeVisible();
  await expect(page.locator('.logs-table')).toHaveCount(0);
  expect(errors).toEqual([]);
});
test('实时空态查历史保留动作与覆盖提示，只查询一次并停止 SSE', async ({ page }) => {
  const requests = await fixture(page, {
    emptyLogs: true,
    stream: (route) =>
      route.fulfill({
        contentType: 'text/event-stream',
        body: `retry: 1000\n\nevent: ping\ndata: ${JSON.stringify(time)}\n\n`,
      }),
  });
  await connect(page);
  await page.getByRole('combobox', { name: '日志动作' }).press('ArrowDown');
  await page.getByRole('option', { name: '已拒绝' }).click();
  await expect
    .poll(
      () =>
        requests.filter((r) => r.path.endsWith('/logs') && r.params.get('action') === 'rejected')
          .length,
    )
    .toBeGreaterThan(0);
  const panel = page.locator('.panel').last();
  await expect(panel.getByText(/部分覆盖/)).toBeVisible();
  await expect(panel.getByText('暂无采集记录，请结合覆盖范围判断')).toBeVisible();
  await page.getByRole('button', { name: '查历史', exact: true }).click();
  await expect(page.getByRole('radio', { name: '历史查询', exact: true })).toBeChecked();
  await expect(panel.getByText('快照内共 0 条')).toBeVisible();
  await expect(panel.getByText(/部分覆盖/)).toBeVisible();
  await expect(page.getByRole('button', { name: '查历史', exact: true })).toHaveCount(0);
  const history = requests.filter((r) => r.path.endsWith('/logs') && r.params.get('size') === '50');
  expect(history).toHaveLength(1);
  expect(history[0]!.params.get('action')).toBe('rejected');
  expect(history[0]!.params.get('page')).toBe('1');
  const count = requests.filter((r) => r.path.endsWith('/stream')).length;
  await page.waitForTimeout(1200);
  expect(requests.filter((r) => r.path.endsWith('/stream'))).toHaveLength(count);
  expect(
    requests.filter((r) => r.path.endsWith('/logs') && r.params.get('size') === '50'),
  ).toHaveLength(1);
});

test('客户端名称与无名称单元格均展示完整 ID tooltip，日志保留溢出 tooltip', async ({ page }) => {
  const namedId = 'named-' + 'a'.repeat(120);
  const unnamedId = 'unnamed-' + 'b'.repeat(120);
  await fixture(page, {
    clients: [
      { ...client, client_id: namedId },
      { ...client, client_id: unnamedId, label: null },
    ],
    logs: [{ ...log(), client_id: namedId }],
  });
  await connect(page);
  for (const [label, id] of [
    [client.label, namedId],
    [unnamedId, unnamedId],
  ]) {
    const cell = page.locator('.client-label').filter({ hasText: label! });
    await expect(cell).toHaveText(label!);
    await cell.hover();
    await expect(page.getByRole('tooltip').filter({ hasText: id! })).toBeVisible();
    await page.mouse.move(0, 0);
    await expect(page.getByRole('tooltip').filter({ hasText: id! })).toBeHidden();
  }
  await page.locator('.logs-table .el-table__body .cell').filter({ hasText: namedId }).hover();
  await expect(
    page.locator('.logs-table').getByRole('tooltip').filter({ hasText: namedId }),
  ).toBeVisible();
});

test('日志详情完整呈现纯文本，行与按钮单次切换，键盘及窄屏可用', async ({ page }) => {
  const message = '<img src=x onerror=alert(1)>\n' + 'long-message-'.repeat(65);
  const record = { ...log(), message, parse_status: 'partial' as const };
  await fixture(page, { logs: [record] });
  await connect(page);
  const row = page.locator('.logs-table .el-table__row');
  const detail = page.locator('.log-details');
  await row.getByRole('cell', { name: '已接受', exact: true }).click();
  await expect(detail.locator('.log-message')).toHaveText(message);
  for (const value of [
    record.log_id,
    record.node_id,
    record.client_id!,
    record.observed_at,
    record.received_at,
    record.source_ip!,
    record.target_domain!,
    record.outbound_tag!,
    record.parse_status,
  ]) {
    await expect(detail).toContainText(value);
  }
  await expect(detail.locator('img')).toHaveCount(0);
  expect(await detail.evaluate((element) => getComputedStyle(element).userSelect)).toBe('text');
  await row.getByRole('cell', { name: '已接受', exact: true }).click();
  await expect(detail).toHaveCount(0);
  await page.getByRole('button', { name: '展开详情', exact: true }).click();
  await expect(detail).toBeVisible();
  await expect(page.getByRole('button', { name: '收起详情' })).toHaveAttribute(
    'aria-expanded',
    'true',
  );
  await page.getByRole('button', { name: '收起详情' }).click();
  await expect(detail).toHaveCount(0);
  const button = page.getByRole('button', { name: '展开详情', exact: true });
  await button.focus();
  await button.press('Enter');
  await expect(detail).toBeVisible();
  await page.getByRole('button', { name: '收起详情' }).press('Space');
  await expect(detail).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: '展开详情', exact: true }).click();
  await expect(detail.locator('.log-message')).toHaveText(message);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(
    await detail
      .locator('.log-message')
      .evaluate((element) => element.scrollWidth <= element.clientWidth),
  ).toBe(true);
});

test('历史查询翻页保持同一时间窗与快照', async ({ page }) => {
  const requests = await fixture(page, { history: true });
  await connect(page);
  await page.getByText('历史查询', { exact: true }).click();
  await expect(page.getByText('快照内共 60 条')).toBeVisible();
  const first = requests
    .filter((request) => request.path.endsWith('/logs') && request.params.get('size') === '50')
    .at(-1)!;
  await page.locator('.panel').last().getByRole('button', { name: 'Go to next page' }).click();
  await expect
    .poll(
      () =>
        requests.filter(
          (request) =>
            request.path.endsWith('/logs') &&
            request.params.get('page') === '2' &&
            request.params.get('size') === '50',
        ).length,
    )
    .toBe(1);
  const second = requests
    .filter((request) => request.path.endsWith('/logs') && request.params.get('size') === '50')
    .at(-1)!;
  expect(second.params.get('from_ms')).toBe(first.params.get('from_ms'));
  expect(second.params.get('to_ms')).toBe(first.params.get('to_ms'));
  expect(second.params.get('as_of_ms')).toBe(String(now));
  await page.getByRole('textbox', { name: '日志关键字' }).fill('example');
  await page.getByRole('button', { name: '查询日志' }).click();
  await expect
    .poll(() => requests.filter((request) => request.params.get('keyword') === 'example').length)
    .toBe(1);
  const fresh = requests.at(-1)!;
  expect(fresh.params.get('page')).toBe('1');
  expect(fresh.params.has('as_of_ms')).toBe(false);
});
test('从原后台菜单进入观察页，共享页签并在离开时释放连接', async ({ page }) => {
  await fixture(page);
  await page.goto('/device');
  await page.getByRole('textbox', { name: '用户名', exact: true }).fill('viewer');
  await page.getByLabel('密码', { exact: true }).fill('Demo@123456');
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await expect(page.getByRole('tab', { name: '设备列表', exact: true })).toBeVisible();
  await page.getByRole('menuitem', { name: 'Xray 观察面板', exact: true }).click();
  await page.getByLabel('访问令牌', { exact: true }).fill('test-observer-token');
  await page.getByRole('button', { name: '连接观察服务' }).click();
  await expect(page.getByRole('heading', { name: '运行概览' })).toBeVisible();
  await page.getByRole('tab', { name: '设备列表', exact: true }).click();
  await expect(page.locator('.observer-page')).toHaveCount(0);
  await page.getByRole('tab', { name: 'Xray 观察面板', exact: true }).click();
  await expect(page.getByLabel('访问令牌', { exact: true })).toHaveValue('');
  await page.getByRole('button', { name: '关闭页签：Xray 观察面板', exact: true }).click();
  await expect(page).toHaveURL('/device');
  await expect(page.getByRole('tab', { name: 'Xray 观察面板', exact: true })).toHaveCount(0);
});
test('SSE 透传游标、409 清游标重建并去重补查', async ({ page }) => {
  const cursor = 'boot:7:abcdef0123456789';
  const requests = await fixture(page, {
    stream: async (route, count) => {
      if (count === 2)
        return json(
          route,
          {
            error: { code: 'cursor_expired', message: '游标已过期', detail: { reason: 'expired' } },
          },
          409,
        );
      return route.fulfill({
        contentType: 'text/event-stream',
        body: `retry: 1000\n\nevent: log\nid: ${cursor}\ndata: ${JSON.stringify({ items: [log()] })}\n\n`,
      });
    },
  });
  await connect(page);
  await expect
    .poll(() => requests.filter((request) => request.path.endsWith('/stream')).length)
    .toBeGreaterThanOrEqual(3);
  const streams = requests.filter((request) => request.path.endsWith('/stream'));
  expect(streams[0]!.cursor).toBeUndefined();
  expect(streams[1]!.cursor).toBe(cursor);
  expect(streams[2]!.cursor).toBeUndefined();
  expect(streams.every((request) => request.auth === 'Bearer test-observer-token')).toBe(true);
  await expect(page.locator('.logs-table .el-table__body tbody tr')).toHaveCount(1);
  expect(
    requests.filter((request) => request.path.endsWith('/logs')).length,
  ).toBeGreaterThanOrEqual(2);
  await page.getByRole('button', { name: '断开连接' }).click();
  const count = streams.length;
  await page.waitForTimeout(1200);
  expect(requests.filter((request) => request.path.endsWith('/stream'))).toHaveLength(count);
});
test('429 实时连接遵守 Retry-After', async ({ page }) => {
  const times: number[] = [];
  await fixture(page, {
    stream: async (route, count) => {
      times.push(Date.now());
      if (count === 1)
        return json(route, { error: { code: 'rate_limited', message: '限流' } }, 429, {
          'Retry-After': '4',
        });
      return route.fulfill({
        contentType: 'text/event-stream',
        body: `event: ping\ndata: ${JSON.stringify(time)}\n\n`,
      });
    },
  });
  await connect(page);
  await expect(page.getByText('实时连接限流，正在等待重试')).toBeVisible();
  await expect.poll(() => times.length, { timeout: 10000 }).toBeGreaterThanOrEqual(2);
  expect(times[1]! - times[0]!).toBeGreaterThanOrEqual(3900);
  await page.getByRole('button', { name: '断开连接' }).click();
});
test('切换节点取消旧请求，迟到的指标不能覆盖新节点', async ({ page }) => {
  await fixture(page);
  await page.route('**/api/v1/nodes?*', (route) =>
    json(route, {
      items: [node, { ...node, node_id: 'node-02', name: '第二节点' }],
      page: 1,
      size: 200,
      total: 2,
    }),
  );
  let release = () => {};
  let firstRequested = false;
  await page.route('**/api/v1/host/metrics?*', async (route) => {
    const query = new URL(route.request().url()).searchParams;
    const first = query.get('node_id') === 'node-01';
    if (first) {
      firstRequested = true;
      await new Promise<void>((resolve) => {
        release = resolve;
      });
    }
    await json(route, {
      node_id: query.get('node_id'),
      range: {
        from_ms: Number(query.get('from_ms')),
        to_ms: Number(query.get('to_ms')),
        step: '1m',
        bucket_anchor_ms: 0,
        coverage,
      },
      points: [
        {
          ...time,
          cpu_usage_ratio: first ? 0.12 : 0.88,
          memory_used_bytes: null,
          memory_total_bytes: null,
          disk_used_bytes: null,
          disk_total_bytes: null,
          network_rx_bytes_per_sec: null,
          network_tx_bytes_per_sec: null,
          sample_count: 2,
        },
      ],
    }).catch(() => {});
  });
  await connect(page);
  await expect.poll(() => firstRequested).toBe(true);
  await page.getByRole('combobox', { name: '观察节点' }).press('ArrowDown');
  await page.getByRole('option', { name: '第二节点' }).click();
  await expect(page.getByText('88.0%', { exact: true })).toBeVisible();
  release();
  await expect(page.getByText('12.0%', { exact: true })).toHaveCount(0);
});
test('窄屏可用且刷新后不保留令牌', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await fixture(page);
  await connect(page);
  await expect(page.getByRole('heading', { name: '运行概览' })).toBeVisible();
  await expect(page.locator('.logs-table .el-table__body tbody tr')).toHaveCount(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'artifacts/observe-mobile.png', fullPage: true });
  await page.reload();
  await expect(page.getByLabel('访问令牌', { exact: true })).toHaveValue('');
});
test('真实后端 smoke（显式提供测试令牌时运行）', async ({ page }) => {
  test.skip(!process.env.OBSERVER_TEST_TOKEN, '仅在明确配置本地联调环境时运行');
  const errors: string[] = [];
  const failed: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('response', (response) => {
    if (response.url().includes('/api/v1/') && response.status() >= 400)
      failed.push(`${response.status()} ${new URL(response.url()).pathname}`);
  });
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto(`${process.env.OBSERVER_LIVE_URL || ''}/observe`);
  await page.getByLabel('访问令牌', { exact: true }).fill(process.env.OBSERVER_TEST_TOKEN!);
  await page.getByRole('button', { name: '连接观察服务' }).click();
  await expect(page.getByText('真实数据 · v1.0.1')).toBeVisible();
  await expect(page.getByText('test-vless', { exact: true })).toBeVisible();
  await expect(page.getByText('实时连接中', { exact: true })).toBeVisible();
  await expect(page.locator('.app-chart svg').first()).toBeVisible();
  await page.getByRole('button', { name: '查看曲线' }).click();
  await expect(page.locator('.traffic-panel').getByText(/累计上行/)).toBeVisible();
  await page.getByText('历史查询', { exact: true }).click();
  await expect(page.getByText(/快照内共/)).toBeVisible();
  await page.getByText('实时日志', { exact: true }).click();
  await expect(page.getByText('实时连接中', { exact: true })).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(page.getByRole('img', { name: '鲸栈' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Xray 观察面板', exact: true })).toBeVisible();
  await page.screenshot({ path: 'artifacts/observe-live.png', fullPage: true });
  await page.getByRole('button', { name: '切换主题', exact: true }).click();
  await page.getByRole('menuitem', { name: '深色模式', exact: true }).click();
  await expect(page.locator('html')).toHaveClass(/dark/);
  await expect(page.locator('.app-chart svg text').filter({ hasText: /^CPU$/ })).toHaveAttribute(
    'fill',
    '#c5cad3',
  );
  await expect(page.locator('html')).not.toHaveClass(/is-theme-transitioning/);
  await page.screenshot({ path: 'artifacts/observe-live-dark.png', fullPage: true });
  expect(errors).toEqual([]);
  expect(failed).toEqual([]);
  await page.getByRole('button', { name: '断开连接' }).click();
});
