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
  anonymous?: boolean;
  realAuth?: boolean;
  history?: boolean;
  emptyLogs?: boolean;
  logs?: LogRecord[];
  clients?: Client[];
  stream?: (route: Route, count: number) => Promise<void>;
};
async function fixture(page: Page, options: FixtureOptions = {}) {
  if (!options.realAuth) {
    let currentSession = 'active';
    if (!options.anonymous)
      await page.context().addCookies([
        {
          name: 'workspace-test-session',
          value: currentSession,
          url: 'http://127.0.0.1:5174',
          httpOnly: true,
          sameSite: 'Lax',
        },
      ]);
    const user = {
      id: 'workspace-test',
      username: 'workspace-user',
      displayName: '工作区用户',
      roles: ['observer'],
      permissions: ['observe:read'],
    };
    await page.route('**/api/auth/**', async (route) => {
      const path = new URL(route.request().url()).pathname;
      const headers = await route.request().allHeaders();
      const valid = (headers.cookie || '').includes(`workspace-test-session=${currentSession}`);
      const send = (status: number, data: unknown = null, message = 'ok', extra = {}) =>
        json(route, { code: status, data, message }, status, extra);
      if (path.endsWith('/setup-status')) return send(200, { setup_required: false });
      if (path.endsWith('/csrf'))
        return send(200, null, 'ok', {
          'Set-Cookie': 'XSRF-TOKEN=test-csrf; Path=/; SameSite=Lax',
        });
      if (path.endsWith('/login')) {
        const credentials = route.request().postDataJSON();
        if (
          credentials.username !== 'workspace-user' ||
          credentials.password !== 'Workspace-Test-Password'
        )
          return send(401, null, '用户名或密码错误');
        currentSession = `active-${Date.now()}`;
        return send(200, user, 'ok', {
          'Set-Cookie': `workspace-test-session=${currentSession}; Path=/; HttpOnly; SameSite=Lax`,
        });
      }
      if (path.endsWith('/logout')) {
        currentSession = 'revoked';
        return send(200, null, 'ok', {
          'Set-Cookie': 'workspace-test-session=; Path=/; Max-Age=0; HttpOnly',
        });
      }
      return valid ? send(200, user) : send(401, null, '登录已过期，请重新登录');
    });
  }
  let streams = 0;
  const requests: {
    path: string;
    params: URLSearchParams;
    auth: string | undefined;
    cookie: string | undefined;
    cursor: string | undefined;
  }[] = [];
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url());
    const requestHeaders = await route.request().allHeaders();
    requests.push({
      path: url.pathname,
      params: url.searchParams,
      auth: route.request().headers().authorization,
      cookie: requestHeaders.cookie,
      cursor: route.request().headers()['last-event-id'],
    });
    const path = url.pathname.replace('/api/v1', '');
    if (!/(workspace-test-session=active|mock-session=)/.test(requestHeaders.cookie || ''))
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
async function connect(page: Page) {
  await page.goto('/overview');
  await expect(page.getByRole('heading', { name: '运行概览' })).toBeVisible();
}

// 模拟持续开放的 SSE，确保 REST 补查重试不是偶然由流断开触发。
async function keepStreamOpen(page: Page) {
  await page.addInitScript(() => {
    const fetcher = window.fetch.bind(window);
    window.fetch = (input, init) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (!url.split('?')[0]!.endsWith('/api/v1/stream')) return fetcher(input, init);
      const signal = init?.signal;
      let abort = () => {};
      return Promise.resolve(
        new Response(
          new ReadableStream({
            start(controller) {
              controller.enqueue(new TextEncoder().encode('event: ping\ndata: {}\n\n'));
              abort = () => controller.error(signal?.reason);
              signal?.addEventListener('abort', abort, { once: true });
            },
            cancel() {
              signal?.removeEventListener('abort', abort);
            },
          }),
          { headers: { 'Content-Type': 'text/event-stream' } },
        ),
      );
    };
  });
}

test('详情在重新查询、切换模式和翻页后收起，按钮关联正确的详情区域', async ({ page }) => {
  await fixture(page, { history: true, logs: [log()] });
  await keepStreamOpen(page);
  await connect(page);
  const details = page.getByRole('region', { name: '日志详情 log-1', exact: true });
  await page.getByRole('button', { name: '展开详情', exact: true }).click();
  await expect(details).toBeVisible();
  await expect(page.getByRole('button', { name: '收起详情' })).toHaveAttribute(
    'aria-controls',
    (await details.getAttribute('id')) as string,
  );
  await page.getByText('历史查询', { exact: true }).click();
  await expect(page.getByText('快照内共 60 条')).toBeVisible();
  await expect(details).toHaveCount(0);
  await expect(page.getByRole('button', { name: '展开详情', exact: true })).toHaveAttribute(
    'aria-expanded',
    'false',
  );
  await page.getByRole('button', { name: '展开详情', exact: true }).click();
  await page.getByRole('button', { name: '查询日志', exact: true }).click();
  await expect(details).toHaveCount(0);
  await page.getByRole('button', { name: '展开详情', exact: true }).click();
  await page
    .locator('.panel')
    .last()
    .getByRole('button', { name: 'Go to next page', exact: true })
    .click();
  await expect(details).toHaveCount(0);
  await expect(page.getByRole('button', { name: '展开详情', exact: true })).toHaveAttribute(
    'aria-expanded',
    'false',
  );
});

test('实时补查限流后自动重试，暂停时取消尚未执行的重试', async ({ page }) => {
  await fixture(page);
  await keepStreamOpen(page);
  const times: number[] = [];
  await page.route('**/api/v1/logs?*', async (route) => {
    times.push(Date.now());
    if (times.length === 1 || times.length === 3)
      return json(route, { error: { code: 'rate_limited', message: '日志补查限流' } }, 429, {
        'Retry-After': '2',
      });
    const params = new URL(route.request().url()).searchParams;
    return json(route, {
      items: [log()],
      page: 1,
      size: 200,
      total: 1,
      from_ms: Number(params.get('from_ms')),
      to_ms: now,
      as_of_ms: now,
      coverage,
    });
  });
  await connect(page);
  await expect.poll(() => times.length).toBe(2);
  expect(times[1]! - times[0]!).toBeGreaterThanOrEqual(1900);
  await expect(page.locator('.logs-table .el-table__row')).toHaveCount(1);
  await expect(page.getByText('日志补查限流', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: '暂停实时', exact: true }).click();
  await page.getByRole('button', { name: '恢复实时', exact: true }).click();
  await expect(page.getByText('日志补查限流', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '暂停实时', exact: true }).click();
  await page.waitForTimeout(2200);
  expect(times).toHaveLength(3);
});
test('统一登录、未知状态、零值、覆盖提示和失效清理', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const oldApi: string[] = [];
  page.on('request', (request) => {
    if (/\/api\/(auth|system)\//.test(request.url())) oldApi.push(request.url());
  });
  const requests = await fixture(page, { anonymous: true });
  await page.goto('/overview');
  await expect(page).toHaveURL(/\/login/);
  await page.getByRole('textbox', { name: '用户名', exact: true }).fill('workspace-user');
  await page.getByLabel('密码', { exact: true }).fill('wrong-password');
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('用户名或密码错误');
  await page.getByLabel('密码', { exact: true }).fill('Workspace-Test-Password');
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await expect(page.getByRole('heading', { name: '运行概览' })).toBeVisible();
  await expect(page.getByRole('img', { name: '鲸栈' })).toBeVisible();
  await expect(page.getByRole('menuitem', { name: '运行概览', exact: true })).toBeVisible();
  await expect(page.getByRole('tab', { name: '运行概览', exact: true })).toBeVisible();
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
  expect(stored).not.toContain('Workspace-Test-Password');
  expect(stored).not.toContain('workspace-test-session');
  expect(oldApi.some((url) => url.includes('/api/auth/login'))).toBe(true);
  expect(oldApi.some((url) => url.includes('/api/system/'))).toBe(false);
  expect(requests.every((request) => request.auth === undefined)).toBe(true);
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
  await page.route('**/api/auth/session', (route) =>
    json(route, { code: 401, data: null, message: '登录已过期，请重新登录' }, 401),
  );
  await page.getByRole('button', { name: '刷新概览' }).click();
  await expect(page).toHaveURL(/\/login/);
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
  await fixture(page, { realAuth: true });
  await page.goto('/device');
  await page.getByRole('textbox', { name: '用户名', exact: true }).fill('admin');
  await page.getByLabel('密码', { exact: true }).fill('Demo@123456');
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await expect(page.getByRole('tab', { name: '设备列表', exact: true })).toBeVisible();
  await page.getByRole('menuitem', { name: '运行概览', exact: true }).click();
  await expect(page.getByRole('heading', { name: '运行概览' })).toBeVisible();
  await page.getByRole('tab', { name: '设备列表', exact: true }).click();
  await expect(page.locator('.overview-page')).toHaveCount(0);
  await page.getByRole('tab', { name: '运行概览', exact: true }).click();
  await expect(page.getByRole('heading', { name: '运行概览' })).toBeVisible();
  await expect(page.getByLabel('访问令牌', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: '关闭页签：运行概览', exact: true }).click();
  await expect(page).toHaveURL('/device');
  await expect(page.getByRole('tab', { name: '运行概览', exact: true })).toHaveCount(0);
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
  expect(streams.every((request) => request.auth === undefined && Boolean(request.cookie))).toBe(
    true,
  );
  await expect(page.locator('.logs-table .el-table__body tbody tr')).toHaveCount(1);
  expect(
    requests.filter((request) => request.path.endsWith('/logs')).length,
  ).toBeGreaterThanOrEqual(2);
  await page.getByRole('button', { name: '账户菜单' }).click();
  await page.getByRole('menuitem', { name: '退出登录', exact: true }).click();
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
  await page.getByRole('button', { name: '账户菜单' }).click();
  await page.getByRole('menuitem', { name: '退出登录', exact: true }).click();
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
test('窄屏可用且刷新后自动复用工作区会话', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await fixture(page);
  await connect(page);
  await expect(page.getByRole('heading', { name: '运行概览' })).toBeVisible();
  await expect(page.locator('.logs-table .el-table__body tbody tr')).toHaveCount(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'artifacts/observe-mobile.png', fullPage: true });
  await page.reload();
  await expect(page.getByRole('heading', { name: '运行概览' })).toBeVisible();
  await expect(page.getByLabel('访问令牌', { exact: true })).toHaveCount(0);
});
test('全宽工作台充分使用大屏，指标与资源平铺', async ({ page }) => {
  await page.setViewportSize({ width: 2560, height: 1440 });
  await fixture(page);
  await connect(page);
  await expect(page.locator('.logs-table .el-table__row')).toHaveCount(1);
  const main = await page.locator('.main-container').boundingBox();
  expect(main!.width).toBeGreaterThan(2000);
  const host = await page.locator('.host-panel').boundingBox();
  const resources = await page.locator('.resources-panel').boundingBox();
  expect(Math.abs(host!.y - resources!.y)).toBeLessThan(2);
  expect(resources!.x).toBeGreaterThan(host!.x + host!.width);
  await page.screenshot({ path: 'artifacts/overview-wide.png', fullPage: true });
});

test('首次设置独立账号只用一次校验码，成功后刷新直接进入工作台', async ({ page }) => {
  await fixture(page, { anonymous: true });
  let configured = false;
  let setups = 0;
  await page.route('**/api/auth/setup-status', (route) =>
    json(route, { code: 200, message: 'ok', data: { setup_required: !configured } }),
  );
  await page.route('**/api/auth/setup', async (route) => {
    setups++;
    const headers = await route.request().allHeaders();
    expect(headers.authorization).toBe('Bearer initial-test-code');
    expect(headers['x-xsrf-token']).toBe('test-csrf');
    expect(route.request().postDataJSON()).toEqual({
      username: 'workspace-user',
      password: 'Initial-Workspace-Password',
    });
    configured = true;
    return json(
      route,
      {
        code: 200,
        message: 'ok',
        data: {
          id: 'workspace-test',
          username: 'workspace-user',
          displayName: '工作区用户',
          roles: ['observer'],
          permissions: ['observe:read'],
        },
      },
      200,
      { 'Set-Cookie': 'workspace-test-session=active; Path=/; HttpOnly; SameSite=Lax' },
    );
  });
  await page.goto('/login');
  await page.getByRole('textbox', { name: '用户名', exact: true }).fill('workspace-user');
  await page.getByLabel('密码', { exact: true }).fill('Initial-Workspace-Password');
  await page.getByLabel('确认密码', { exact: true }).fill('mismatch-password');
  await page.getByLabel('初始化校验码', { exact: true }).fill('initial-test-code');
  await page.getByRole('button', { name: '创建账号并进入', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('两次输入的密码不一致');
  expect(setups).toBe(0);
  await page.getByLabel('确认密码', { exact: true }).fill('Initial-Workspace-Password');
  await page.getByRole('button', { name: '创建账号并进入', exact: true }).click();
  await expect(page.getByRole('heading', { name: '运行概览' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: '运行概览' })).toBeVisible();
  await expect(page.getByLabel('初始化校验码', { exact: true })).toHaveCount(0);
  expect(setups).toBe(1);
  expect(
    await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage })),
  ).not.toContain('initial-test-code');
});

test('备用实例首次创建账号、会话恢复、退出撤销及重新登录', async ({ page }) => {
  test.skip(
    !process.env.OBSERVER_TEST_BOOTSTRAP ||
      !process.env.OBSERVER_TEST_USERNAME ||
      !process.env.OBSERVER_TEST_PASSWORD,
    '仅在显式配置的隔离备用实例执行首次设置',
  );
  const url = process.env.OBSERVER_LIVE_URL!;
  // 防止测试账号意外写入用户正在使用的正式实例。
  expect(new URL(url).port).toBe('18083');
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto(url + '/login');
  await page
    .getByRole('textbox', { name: '用户名', exact: true })
    .fill(process.env.OBSERVER_TEST_USERNAME!);
  await page.getByLabel('密码', { exact: true }).fill(process.env.OBSERVER_TEST_PASSWORD!);
  await page.getByLabel('确认密码', { exact: true }).fill(process.env.OBSERVER_TEST_PASSWORD!);
  await page.getByLabel('初始化校验码', { exact: true }).fill(process.env.OBSERVER_TEST_BOOTSTRAP!);
  await page.getByRole('button', { name: '创建账号并进入', exact: true }).click();
  await expect(page.getByRole('heading', { name: '运行概览' })).toBeVisible();
  await expect(page.getByText('实时连接中', { exact: true })).toBeVisible();
  const oldSession = (await page.context().cookies()).find(
    (cookie) => cookie.name === 'observe-session',
  )!;
  expect(oldSession.httpOnly).toBe(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: '运行概览' })).toBeVisible();
  await expect(page.getByLabel('访问令牌', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: '账户菜单' }).click();
  await page.getByRole('menuitem', { name: '退出登录', exact: true }).click();
  await expect(page).toHaveURL(/\/login/);
  const replay = await page.request.get(url + '/api/v1/overview', {
    headers: { Cookie: `observe-session=${oldSession.value}` },
  });
  expect(replay.status()).toBe(401);
  await expect(page.getByLabel('初始化校验码', { exact: true })).toHaveCount(0);
  await page
    .getByRole('textbox', { name: '用户名', exact: true })
    .fill(process.env.OBSERVER_TEST_USERNAME!);
  await page.getByLabel('密码', { exact: true }).fill(process.env.OBSERVER_TEST_PASSWORD!);
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await expect(page.getByRole('heading', { name: '运行概览' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('真实后端统一登录 smoke（显式配置测试账号时运行）', async ({ page }) => {
  test.skip(
    !process.env.OBSERVER_TEST_USERNAME || !process.env.OBSERVER_TEST_PASSWORD,
    '需要独立测试实例及测试账号',
  );
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const url = process.env.OBSERVER_LIVE_URL || '';
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto(url + '/overview');
  await page
    .getByRole('textbox', { name: '用户名', exact: true })
    .fill(process.env.OBSERVER_TEST_USERNAME!);
  await page.getByLabel('密码', { exact: true }).fill(process.env.OBSERVER_TEST_PASSWORD!);
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await expect(page.getByRole('heading', { name: '运行概览' })).toBeVisible();
  await expect(page.getByText('真实数据', { exact: true })).toBeVisible();
  await expect(page.getByText('test-vless', { exact: true })).toBeVisible();
  await expect(page.getByText('实时连接中', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: '运行概览' })).toBeVisible();
  await expect(page.getByLabel('访问令牌', { exact: true })).toHaveCount(0);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: 'artifacts/overview-live.png', fullPage: true });
  await page.getByRole('button', { name: '切换主题', exact: true }).click();
  await page.getByRole('menuitem', { name: '深色模式', exact: true }).click();
  await expect(page.locator('html')).not.toHaveClass(/is-theme-transitioning/);
  await page.screenshot({ path: 'artifacts/overview-live-dark.png', fullPage: true });
  await page.getByRole('button', { name: '账户菜单' }).click();
  await page.getByRole('menuitem', { name: '退出登录', exact: true }).click();
  await expect(page).toHaveURL(/\/login/);
  expect(errors).toEqual([]);
});
