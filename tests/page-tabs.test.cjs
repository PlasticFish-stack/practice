const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createPinia } = require('pinia');
const { createLoader } = require('./helpers/load-ts.cjs');

function setup() {
  const module = createLoader()('src/stores/pageTabs.ts');
  return { tabs: module.usePageTabsStore(createPinia()), max: module.MAX_PAGE_TABS };
}
const page = (key, fullPath = key) => ({ key, fullPath, name: key, title: key, keepAlive: true });

test('tab visits reuse one page across query changes and preserve its instance and scroll', () => {
  const { tabs } = setup();
  tabs.visit(page('/account/center'));
  const id = tabs.items[0].id;
  tabs.rememberScroll('/account/center', { x: 0, y: 280 });
  tabs.visit(page('/account/center', '/account/center?edit=1'));
  assert.equal(tabs.items.length, 1);
  assert.equal(tabs.items[0].id, id);
  assert.equal(tabs.items[0].fullPath, '/account/center?edit=1');
  assert.equal(tabs.items[0].scroll.y, 280);
});

test('close and refresh invalidate only the target cache; reopening after clear cannot reuse the old key', () => {
  const { tabs } = setup();
  tabs.visit(page('/a'));
  tabs.visit(page('/b'));
  const a = tabs.items[0].id,
    b = tabs.items[1].id;
  tabs.refresh('/a');
  assert.notEqual(tabs.items[0].id, a);
  assert.equal(tabs.items[1].id, b);
  tabs.remove('/a');
  tabs.visit(page('/a'));
  assert.notEqual(tabs.items[1].id, a);
  assert.equal(tabs.items[0].id, b);
  tabs.clear();
  tabs.visit(page('/b'));
  assert.notEqual(tabs.items[0].id, b);
});

test('tab cache is bounded and evicts least recently visited pages', () => {
  const { tabs, max } = setup();
  for (let index = 0; index < max; index++) tabs.visit(page('/' + index));
  tabs.visit(page('/0'));
  tabs.visit(page('/new'));
  assert.equal(tabs.items.length, max);
  assert.equal(
    tabs.items.some((item) => item.key === '/0'),
    true,
  );
  assert.equal(
    tabs.items.some((item) => item.key === '/1'),
    false,
  );
  assert.equal(tabs.items.at(-1).key, '/new');
});

test('permission reconciliation drops inaccessible tabs while updating remaining titles', () => {
  const { tabs } = setup();
  tabs.visit(page('/a'));
  tabs.visit(page('/b'));
  const id = tabs.items[0].id;
  tabs.reconcile((tab) => (tab.key === '/b' ? null : { ...tab, title: '新名称' }));
  assert.equal(tabs.items.length, 1);
  assert.equal(tabs.items[0].id, id);
  assert.equal(tabs.items[0].title, '新名称');
});
