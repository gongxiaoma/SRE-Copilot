import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [vue()],
    server: {
      proxy: {
        '/api': {
          target: env.HOLMES_PROXY_TARGET || 'http://172.16.119.92:30395',
          changeOrigin: true,
        },
      },
    },
  }
})
