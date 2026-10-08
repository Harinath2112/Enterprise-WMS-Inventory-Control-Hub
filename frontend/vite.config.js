import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const target = env.VITE_API_PROXY_TARGET || 'http://localhost:8000'

  const proxyConfig = {
    target,
    changeOrigin: true,
    secure: true,
    headers: {
      'ngrok-skip-browser-warning': 'true',
    },
    configure(proxy) {
      proxy.on('error', (error, request) => {
        console.error(
          `[Proxy Error] ${request.method} ${request.url}`,
          error.code || error.message,
        )
      })

      proxy.on('proxyRes', (response, request) => {
        console.log(
          `[Proxy Response] ${request.method} ${request.url} → ${response.statusCode}`,
        )
      })
    },
  }

  return {
    plugins: [react()],

    server: {
      host: '0.0.0.0',
      port: 5174,

      proxy: {
        '/api': proxyConfig,
        '/uploads': proxyConfig,
        '/images': proxyConfig,
      },
    },
  }
})