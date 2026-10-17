import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '../..', 'VITE_')
  const origins = new Set<string>()
  for (const key of ['VITE_API_BASE_URL', 'VITE_SUPABASE_URL']) {
    if (env[key]) origins.add(new URL(env[key]).origin)
  }
  const headers = `/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: no-referrer
  X-Frame-Options: DENY
  Permissions-Policy: camera=(), geolocation=(), microphone=(self)
  Content-Security-Policy: default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob:; media-src 'self' blob:; frame-src 'self' blob:; connect-src 'self' ${[...origins].join(' ')}
`
  return { envDir: '../..', plugins: [react(), { name: 'public-deployment-headers', generateBundle() {
    this.emitFile({ type: 'asset', fileName: '_headers', source: headers })
  } }], build: { sourcemap: false }, server: { strictPort: true } }
})
