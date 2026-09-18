import vue from '@vitejs/plugin-vue'
import { viteMockServe } from 'vite-plugin-mock'
import path from 'path'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ command, mode }) => ({
  plugins: [
    vue(),
    viteMockServe({
      mockPath: './src/mocks',
      enable: command === "serve" && mode === "mock",
    })
  ],
    resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src')
    }
  },
}))
