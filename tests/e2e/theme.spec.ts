import { test as base, expect, type Page } from '@playwright/test';

const test = base.extend<{ runtimeErrors: string[] }>({
  runtimeErrors: [
    async ({ page }, use) => {
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await use(errors);
      expect(errors).toEqual([]);
    },
    { auto: true },
  ],
});

async function login(page: Page) {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.addInitScript(() => localStorage.setItem('ui.theme', 'light'));
  await page.goto('/device');
  await page.getByRole('textbox', { name: '用户名', exact: true }).fill('admin');
  await page.getByLabel('密码', { exact: true }).fill('Demo@123456');
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await expect(page).toHaveURL('/device');
  await expect(page.getByRole('heading', { name: '设备列表', exact: true })).toBeVisible();
}

async function choose(page: Page, name: string, keyboard = false) {
  const trigger = page.getByRole('button', { name: '切换主题', exact: true });
  if (keyboard) await trigger.press('Enter');
  else await trigger.click();
  const item = page.getByRole('menuitem', { name, exact: true });
  if (keyboard) await item.press('Enter');
  else await item.click();
}

async function pauseTransition(page: Page) {
  await page.waitForFunction(() => {
    const animation = document
      .getAnimations()
      .find(
        (animation) =>
          animation.playState === 'running' &&
          animation.effect instanceof KeyframeEffect &&
          animation.effect.pseudoElement === '::view-transition-new(root)',
      );
    if (!animation) return false;
    animation.pause();
    animation.currentTime = Number(animation.effect!.getTiming().duration) / 2;
    return true;
  });
  // Let the paused opacity and the snapshot paint before inspecting the visual frame.
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  const opacity = await page.evaluate(() =>
    Number(getComputedStyle(document.documentElement, '::view-transition-new(root)').opacity),
  );
  expect(opacity).toBeGreaterThan(0);
  expect(opacity).toBeLessThan(1);
  return page.evaluate(() => {
    const animation = document
      .getAnimations()
      .find(
        (animation) =>
          animation.effect instanceof KeyframeEffect &&
          animation.effect.pseudoElement === '::view-transition-new(root)',
      )!;
    const frames = (animation.effect as KeyframeEffect).getKeyframes();
    return frames.map((frame) => ({
      opacity: frame.opacity,
      clipPath: frame.clipPath,
      transform: frame.transform,
    }));
  });
}

async function finishTransition(page: Page) {
  await page.evaluate(() => {
    for (const animation of document.getAnimations()) {
      if (
        animation.effect instanceof KeyframeEffect &&
        animation.effect.pseudoElement === '::view-transition-new(root)'
      )
        animation.finish();
    }
  });
  await expect(page.locator('html')).not.toHaveClass(/is-theme-transitioning/);
}

test('new themes fade uniformly in both directions without moving page content or losing drafts', async ({
  page,
}) => {
  await login(page);
  const input = page.getByRole('textbox', { name: '设备名称', exact: true });
  await input.fill('保留筛选草稿');
  const bounds = await input.boundingBox();
  for (const [name, dark] of [
    ['深色模式', true],
    ['浅色模式', false],
  ] as const) {
    await choose(page, name);
    const frames = await pauseTransition(page);
    expect(frames.map((frame) => frame.opacity)).toEqual(['0', '1']);
    expect(frames.every((frame) => !frame.clipPath && !frame.transform)).toBe(true);
    expect(await input.boundingBox()).toEqual(bounds);
    await expect(page.locator('html')).toHaveClass(dark ? /dark/ : /^(?!.*\bdark\b)/);
    await page.screenshot({
      path: `artifacts/theme-fade-${dark ? 'dark' : 'light'}.png`,
      animations: 'allow',
    });
    await finishTransition(page);
    await expect(input).toHaveValue('保留筛选草稿');
    expect(await page.evaluate(() => localStorage.getItem('ui.theme'))).toBe(
      dark ? 'dark' : 'light',
    );
  }
});

test('keyboard selection uses the same fade and system changes stay automatic', async ({
  page,
}) => {
  await login(page);
  await page.emulateMedia({ colorScheme: 'dark' });
  await choose(page, '深色模式', true);
  const frames = await pauseTransition(page);
  expect(frames.map((frame) => frame.opacity)).toEqual(['0', '1']);
  await finishTransition(page);
  await choose(page, '跟随系统');
  await expect(page.locator('html')).not.toHaveClass(/is-theme-transitioning/);
  await expect.poll(() => page.evaluate(() => localStorage.getItem('ui.theme'))).toBe('system');
  await page.emulateMedia({ colorScheme: 'light' });
  await expect(page.locator('html')).not.toHaveClass(/dark|is-theme-transitioning/);
});

for (const fallback of ['reduced motion', 'unsupported browser']) {
  test(`theme selection works without animation for ${fallback}`, async ({ page }) => {
    await login(page);
    if (fallback === 'reduced motion') await page.emulateMedia({ reducedMotion: 'reduce' });
    else
      await page.evaluate(() => {
        Object.defineProperty(document, 'startViewTransition', { value: undefined });
      });
    await choose(page, '深色模式');
    await expect(page.locator('html')).toHaveClass(/dark/);
    await expect(page.locator('html')).not.toHaveClass(/is-theme-transitioning/);
    expect(await page.evaluate(() => localStorage.getItem('ui.theme'))).toBe('dark');
  });
}

test('a later selection cancels the previous fade without restoring its old theme', async ({
  page,
}) => {
  await login(page);
  await choose(page, '深色模式');
  await pauseTransition(page);
  // Dispatch the trigger while the test deliberately holds the compositor animation paused.
  await page.getByRole('button', { name: '切换主题', exact: true }).dispatchEvent('click');
  await page.getByRole('menuitem', { name: '浅色模式', exact: true }).click();
  await pauseTransition(page);
  await finishTransition(page);
  await expect(page.locator('html')).not.toHaveClass(/dark|is-theme-transitioning/);
  expect(await page.evaluate(() => localStorage.getItem('ui.theme'))).toBe('light');
});
