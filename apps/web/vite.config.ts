import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({ envDir: '../..', plugins: [react()], build: { sourcemap: false }, server: { strictPort: true } })
