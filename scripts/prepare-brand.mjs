/* global Image, document */
import process from 'node:process';
import { Buffer } from 'node:buffer';
import { URL } from 'node:url';
import { readFile, writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';

// 从矢量图标生成 PNG 兼容资源；顶部直接使用 SVG。
const source = await readFile(new URL('../public/favicon.svg', import.meta.url));
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge' });
try {
  const page = await browser.newPage();
  const variants = await page.evaluate(async (encoded) => {
    const image = new Image();
    image.src = `data:image/svg+xml;base64,${encoded}`;
    await image.decode();
    return [
      { size: 64, type: 'image/png' },
      { size: 180, type: 'image/png' },
    ].map(({ size, type }) => {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = size;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Canvas unavailable');
      context.imageSmoothingQuality = 'high';
      context.drawImage(image, 0, 0, size, size);
      return canvas.toDataURL(type, 0.9).split(',')[1];
    });
  }, source.toString('base64'));
  for (const [index, path] of [
    '../public/favicon.png',
    '../public/apple-touch-icon.png',
  ].entries()) {
    const bytes = Buffer.from(variants[index], 'base64');
    await writeFile(new URL(path, import.meta.url), bytes);
    process.stdout.write(`${path}: ${(bytes.length / 1024).toFixed(1)} KB\n`);
  }
} finally {
  await browser.close();
}
