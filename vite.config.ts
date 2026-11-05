import vue from '@vitejs/plugin-vue';
import { mockApiPlugin } from './mock/server.ts';
import path from 'path';
import { existsSync, readdirSync } from 'node:fs';
import { defineConfig } from 'vite';
import AutoImport from 'unplugin-auto-import/vite';
import Components from 'unplugin-vue-components/vite';
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers';

// Resolver 使用无扩展名导入；从安装包生成确切入口，避免 glob 只匹配到物理 .mjs 文件。
const styleRoot = new URL('./node_modules/element-plus/es/components/', import.meta.url);
const elementStyles = readdirSync(styleRoot)
  .filter((name) => existsSync(new URL(`${name}/style/css.mjs`, styleRoot)))
  .map((name) => `element-plus/es/components/${name}/style/css`);

// https://vite.dev/config/
export default defineConfig(({ command, mode }) => ({
  // 隔离测试服务与日常开发的预构建缓存，避免并发重建导致旧依赖 504。
  cacheDir: process.env.PLAYWRIGHT_TEST ? 'node_modules/.vite-e2e' : 'node_modules/.vite',
  optimizeDeps: {
    // 自动组件插件在转换 Vue 文件时才添加样式导入；提前覆盖深层导入，避免首访反复重建。
    include: [
      'element-plus',
      'element-plus/es',
      'element-plus/es/components/date-picker/index',
      ...elementStyles,
    ],
  },
  plugins: [
    vue(),
    ...(command === 'serve' && mode === 'mock' ? [mockApiPlugin()] : []),
    AutoImport({
      resolvers: [ElementPlusResolver()],
    }),
    Components({
      resolvers: [ElementPlusResolver()],
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
    },
  },
}));
